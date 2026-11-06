-- Motor Wallah — buyer ↔ dealer chat.
--
-- Run this once in Supabase → SQL Editor → New query → Run. It is idempotent:
-- re-running replaces the functions and policies and leaves existing messages
-- untouched.
--
-- Who is who
--   buyer   the visitor's anonymous Supabase session (auth.uid())
--   dealer  a dealer portal account (DLR-1001 …). Dealers do not have their own
--           Supabase login, so a dealer's browser *claims* a dealer id in
--           public.dealer_claims the first time they open the portal. Every RLS
--           rule below checks that claim, never a value the page sends.
--
-- Read the self-test at the bottom: every row must say OK.

/* ------------------------------------------------------------------ tables */

create table if not exists public.chats (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dealer_id       text not null,
  dealer_name     text not null default '',
  vehicle_id      text not null,
  vehicle_label   text not null default '',
  buyer_name      text not null default '',
  buyer_mobile    text not null default '',
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- One conversation per buyer, dealer and vehicle: clicking "Chat with
  -- seller" again reopens the same thread instead of starting a duplicate.
  unique (buyer_id, dealer_id, vehicle_id)
);

create index if not exists chats_dealer_idx on public.chats (dealer_id, last_message_at desc);
create index if not exists chats_buyer_idx on public.chats (buyer_id, last_message_at desc);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.chats(id) on delete cascade,
  sender_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_role  text not null check (sender_role in ('buyer', 'dealer')),
  message_text text not null check (char_length(btrim(message_text)) between 1 and 1000),
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists messages_chat_idx on public.messages (chat_id, created_at);

-- Which browser (Supabase user) speaks for which dealer account.
create table if not exists public.dealer_claims (
  dealer_id   text not null,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dealer_name text not null default '',
  created_at  timestamptz not null default now(),
  primary key (dealer_id, user_id)
);

/* --------------------------------------------------------------- helpers --
 * security definer so a policy can look at sibling rows without recursing
 * through the other table's RLS. Each helper answers only for auth.uid().
 */

create or replace function public.is_my_dealer(p_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dealer_claims c
    where c.dealer_id = p_dealer_id and c.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_chat(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chats c
    where c.id = p_chat_id
      and (c.buyer_id = auth.uid() or public.is_my_dealer(c.dealer_id))
  );
$$;

/** 'buyer' / 'dealer' for the caller on this chat, null when they are neither. */
create or replace function public.my_chat_role(p_chat_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when c.buyer_id = auth.uid() then 'buyer'
           when public.is_my_dealer(c.dealer_id) then 'dealer'
         end
  from public.chats c
  where c.id = p_chat_id;
$$;

/**
 * May the caller write as `p_role` in this chat?
 *
 * One browser can be both a buyer and a dealer account (chat on a listing,
 * then sign into the portal). The side is therefore chosen by the surface the
 * message was typed on, and checked here: a buyer may only write as the buyer
 * of their own chat, a dealer only for a dealer account it has claimed.
 */
create or replace function public.can_send_as(p_chat_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chats c
    where c.id = p_chat_id
      and case p_role
            when 'buyer'  then c.buyer_id = auth.uid()
            when 'dealer' then public.is_my_dealer(c.dealer_id)
            else false
          end
  );
$$;

/* ------------------------------------------------------------------- RLS */

alter table public.chats         enable row level security;
alter table public.messages      enable row level security;
alter table public.dealer_claims enable row level security;

drop policy if exists chats_read   on public.chats;
drop policy if exists chats_insert on public.chats;
drop policy if exists chats_update on public.chats;

create policy chats_read on public.chats
  for select using (buyer_id = auth.uid() or public.is_my_dealer(dealer_id));

-- A chat always belongs to the caller as the buyer; nobody can forge a chat
-- on someone else's behalf.
create policy chats_insert on public.chats
  for insert with check (buyer_id = auth.uid());

create policy chats_update on public.chats
  for update using (buyer_id = auth.uid() or public.is_my_dealer(dealer_id))
  with check   (buyer_id = auth.uid() or public.is_my_dealer(dealer_id));

drop policy if exists messages_read   on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;

create policy messages_read on public.messages
  for select using (public.can_read_chat(chat_id));

-- The sender must be the caller *and* speak for the side they claim: a buyer
-- cannot post as the dealer, and a dealer cannot post into a stranger's chat.
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid() and public.can_send_as(chat_id, sender_role)
  );

-- Only used to flip is_read.
create policy messages_update on public.messages
  for update using (public.can_read_chat(chat_id))
  with check   (public.can_read_chat(chat_id));

drop policy if exists claims_read   on public.dealer_claims;
drop policy if exists claims_insert on public.dealer_claims;
drop policy if exists claims_delete on public.dealer_claims;

create policy claims_read on public.dealer_claims
  for select using (user_id = auth.uid());
create policy claims_insert on public.dealer_claims
  for insert with check (user_id = auth.uid());
create policy claims_delete on public.dealer_claims
  for delete using (user_id = auth.uid());

/* --------------------------------------------------------------- triggers */

create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_chat on public.messages;
create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_last_message();

/* -------------------------------------------------------------------- API */

/** Open (or reopen) the buyer's conversation about one vehicle. */
create or replace function public.open_chat(
  p_dealer_id text,
  p_vehicle_id text,
  p_dealer_name text default '',
  p_vehicle_label text default '',
  p_buyer_name text default '',
  p_buyer_mobile text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.chats (buyer_id, dealer_id, dealer_name, vehicle_id, vehicle_label,
                            buyer_name, buyer_mobile)
  values (auth.uid(), p_dealer_id, coalesce(p_dealer_name, ''), p_vehicle_id,
          coalesce(p_vehicle_label, ''), coalesce(p_buyer_name, ''), coalesce(p_buyer_mobile, ''))
  on conflict (buyer_id, dealer_id, vehicle_id) do update
    set dealer_name   = coalesce(nullif(excluded.dealer_name, ''), public.chats.dealer_name),
        vehicle_label = coalesce(nullif(excluded.vehicle_label, ''), public.chats.vehicle_label),
        buyer_name    = coalesce(nullif(excluded.buyer_name, ''), public.chats.buyer_name),
        buyer_mobile  = coalesce(nullif(excluded.buyer_mobile, ''), public.chats.buyer_mobile)
  returning id into v_id;

  return v_id;
end;
$$;

-- The pre-`p_as` signature would otherwise survive alongside the new one, and
-- PostgREST answers an ambiguous 2-argument call with HTTP 300.
drop function if exists public.send_chat_message(uuid, text);

/** Send one message, as whoever the caller actually is on this chat. */
create or replace function public.send_chat_message(
  p_chat_id uuid,
  p_message_text text,
  p_as text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_row public.messages;
begin
  -- The surface says which side is typing; the database decides whether the
  -- caller really holds that side. Without a preference, infer it.
  v_role := nullif(btrim(coalesce(p_as, '')), '');
  if v_role is null then
    v_role := public.my_chat_role(p_chat_id);
  end if;

  if v_role is null
     or v_role not in ('buyer', 'dealer')
     or not public.can_send_as(p_chat_id, v_role) then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;

  insert into public.messages (chat_id, sender_id, sender_role, message_text)
  values (p_chat_id, auth.uid(), v_role, btrim(p_message_text))
  returning * into v_row;

  return v_row;
end;
$$;

/** Everything the reader received in this chat is now seen. */
create or replace function public.mark_chat_read(p_chat_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.can_read_chat(p_chat_id) then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;

  update public.messages
     set is_read = true
   where chat_id = p_chat_id and is_read = false and sender_id <> auth.uid();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/** Register this browser as speaking for a dealer account. */
create or replace function public.claim_dealer(p_dealer_id text, p_dealer_name text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.dealer_claims (dealer_id, user_id, dealer_name)
  values (p_dealer_id, auth.uid(), coalesce(p_dealer_name, ''))
  on conflict (dealer_id, user_id) do update
    set dealer_name = coalesce(nullif(excluded.dealer_name, ''), public.dealer_claims.dealer_name);
end;
$$;

-- One summary row per conversation, for one side. `unread` counts the other
-- side's messages this reader has not opened.
create or replace function public.my_chats()
returns table (
  id uuid,
  dealer_id text,
  dealer_name text,
  vehicle_id text,
  vehicle_label text,
  buyer_name text,
  buyer_mobile text,
  last_message_at timestamptz,
  last_message text,
  last_sender_role text,
  unread integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.dealer_id,
         c.dealer_name,
         c.vehicle_id,
         c.vehicle_label,
         c.buyer_name,
         c.buyer_mobile,
         c.last_message_at,
         (select m.message_text from public.messages m where m.chat_id = c.id
           order by m.created_at desc limit 1),
         (select m.sender_role from public.messages m where m.chat_id = c.id
           order by m.created_at desc limit 1),
         (select count(*)::int from public.messages m
           where m.chat_id = c.id and not m.is_read and m.sender_role = 'dealer')
  from public.chats c
  where c.buyer_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.dealer_chats(p_dealer_id text)
returns table (
  id uuid,
  dealer_id text,
  dealer_name text,
  vehicle_id text,
  vehicle_label text,
  buyer_name text,
  buyer_mobile text,
  last_message_at timestamptz,
  last_message text,
  last_sender_role text,
  unread integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.dealer_id,
         c.dealer_name,
         c.vehicle_id,
         c.vehicle_label,
         c.buyer_name,
         c.buyer_mobile,
         c.last_message_at,
         (select m.message_text from public.messages m where m.chat_id = c.id
           order by m.created_at desc limit 1),
         (select m.sender_role from public.messages m where m.chat_id = c.id
           order by m.created_at desc limit 1),
         (select count(*)::int from public.messages m
           where m.chat_id = c.id and not m.is_read and m.sender_role = 'buyer')
  from public.chats c
  where c.dealer_id = p_dealer_id
    and public.is_my_dealer(p_dealer_id)
  order by c.last_message_at desc;
$$;

/* ---------------------------------------------------------------- realtime */

-- Live delivery of new messages. The app also polls every 5 seconds, so chat
-- keeps working even when realtime is unavailable for the project.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;   -- already added
  when undefined_object then null;   -- publication not present on this project
end
$$;

alter table public.messages replica identity full;

/* --------------------------------------------------------------- self-test */

do $$
declare
  v_tables int;
  v_policies int;
  v_funcs int;
begin
  select count(*) into v_tables
    from information_schema.tables
   where table_schema = 'public' and table_name in ('chats', 'messages', 'dealer_claims');
  raise notice 'chat self-test: % of 3 tables exist — %',
    v_tables, case when v_tables = 3 then 'OK' else 'MISSING' end;

  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename in ('chats', 'messages', 'dealer_claims');
  raise notice 'chat self-test: % RLS policies (expect 9) — %',
    v_policies, case when v_policies >= 9 then 'OK' else 'INCOMPLETE' end;

  -- One row per name, so a leftover overload cannot inflate the count.
  select count(distinct p.proname) into v_funcs
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('open_chat', 'send_chat_message', 'mark_chat_read',
                       'claim_dealer', 'my_chats', 'dealer_chats');
  raise notice 'chat self-test: % of 6 functions — %',
    v_funcs, case when v_funcs = 6 then 'OK' else 'MISSING' end;

  select count(*) into v_tables
    from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages';
  raise notice 'chat self-test: realtime on messages — %',
    case when v_tables = 1 then 'OK (or polling every 5s takes over)' else 'polling only' end;
end
$$;
