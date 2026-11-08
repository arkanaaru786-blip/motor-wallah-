import { supabaseClient, supabaseConfigured } from "@/lib/supabase";

/**
 * Cloud data layer (Supabase).
 *
 * Every store in this project used to read and write JSON directly in
 * `window.localStorage`. They now all go through this module instead:
 *
 *   replicaRead(key)   – synchronous read of the on-device replica
 *   replicaWrite(key)  – write the replica, then push the value to Supabase
 *
 * The replica is kept because the stores are read synchronously during render
 * (cart badges, admin tables, dashboards). localStorage is therefore demoted to
 * a cache: Supabase `app_records` is the durable copy, and on start-up the
 * newest side wins per key. That keeps every existing UI path working while no
 * longer treating the browser as the database — a cleared browser restores from
 * the cloud on the next load.
 *
 * Identity: visitors are signed in anonymously (`auth.signInAnonymously`), so
 * each browser gets a real Supabase user and RLS can scope rows with
 * `auth.uid()`. If anonymous sign-ins are disabled on the project (or the
 * tables have not been created yet) everything keeps working from the replica
 * and the app reports "offline" instead of failing.
 */

const TABLE = "app_records";
/** Companion key holding the last local write timestamp for conflict checks. */
const STAMP_PREFIX = "mw_synced_at:";
const PUSH_DEBOUNCE_MS = 350;
const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

/**
 * Every collection that lives in Supabase `app_records`.
 *
 * Keep in sync with the `*_KEY` constants in the stores. Device-local secrets
 * are deliberately absent: the admin session (`mw_admin_session`), the admin
 * login attempt counter (`mw_admin_attempts`), the Supabase auth token itself
 * and the device id never leave the browser.
 */
export const CLOUD_COLLECTIONS = [
  // Customer
  "mw_buy_shortlist",
  "mw_lead_queue",
  "mw_my_listing_status",
  "mw_customer_profiles",
  "mw_listing_chat",
  "mw_chat_read",
  "mw_chat_pending",
  "mw_listing_offers",
  "mw_decor_cart",
  "mw_parts_cart",
  /** Prepaid orders confirmed by Razorpay (see lib/razorpay-checkout.ts). */
  "mw_payments",
  // Admin console
  "mw_admin_accounts",
  "mw_admin_cases_v1",
  "mw_admin_case_journal_v1",
  "mw_admin_employees_v2",
  "mw_admin_employees_v1",
  "mw_admin_audit_v1",
  "mw_admin_activity_v1",
  "mw_admin_seeded_v1",
  "mw_admin_rules_v1",
  "mw_admin_rule_runs_v1",
  "mw_admin_notifications_v1",
  "mw_admin_subscriptions_v1",
  "mw_admin_autopilot_state_v1",
  "mw_admin_autopilot_seeded_v1",
  "mw_admin_autopilot_marks_v1",
  "mw_admin_reconcile_v1",
  // Employee dashboard — one collection per desk, never merged
  "mw_desk_sales_v1",
  "mw_desk_workshop_v1",
  "mw_desk_parts_v1",
  "mw_desk_finance_v1",
  "mw_desk_insurance_v1",
  // Dealer portal
  "mw_dealers_v1",
  "mw_dealer_portal_v1",
  // Partner portals (workshop / auto parts / decor)
  "mw_partners_v1",
  "mw_partner_jobs_v1",
  "mw_partner_orders_v1",
  "mw_partner_inventory_v1",
] as const;

const CLOUD_KEYS = new Set<string>(CLOUD_COLLECTIONS);

export type CloudStatus = "local" | "connecting" | "online" | "offline";

let status: CloudStatus = supabaseConfigured ? "connecting" : "local";
let ownerId: string | null = null;
let booting: Promise<void> | null = null;
let bound = false;

const listeners = new Set<() => void>();
const timers = new Map<string, number>();
const retries = new Map<string, number>();
const unsynced = new Set<string>();

/* --------------------------------------------------------------- replica */

const isBrowser = () => typeof window !== "undefined";

function readStamp(key: string): number {
  try {
    const raw = window.localStorage.getItem(STAMP_PREFIX + key);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeStamp(key: string, at: number) {
  try {
    window.localStorage.setItem(STAMP_PREFIX + key, String(at));
  } catch {
    /* the stamp is only used for conflict resolution — safe to lose */
  }
}

/** Synchronous read of the replicated collection. */
export function replicaRead<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** True when this collection has been written at least once on this device. */
export function replicaHas(key: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Write a collection. The replica is updated first so the caller's UI never
 * waits on the network; the cloud push is debounced and retried in the
 * background. Returns false only when the browser blocks storage entirely.
 */
export function replicaWrite(key: string, value: unknown): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  writeStamp(key, Date.now());
  if (CLOUD_KEYS.has(key)) schedulePush(key);
  return true;
}

/** Remove a collection from the replica and from the cloud. */
export function replicaRemove(key: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.removeItem(key);
  } catch {
    return false;
  }
  if (CLOUD_KEYS.has(key)) {
    unsynced.add(key);
    void deleteRemote(key);
  }
  return true;
}

/* ------------------------------------------------------------------ status */

export const cloudStatus = () => status;
export const cloudOwnerId = () => ownerId;

export function subscribeToCloud(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one broken subscriber must not stop the others */
    }
  });
}

function setStatus(next: CloudStatus) {
  if (status === next) return;
  status = next;
  notify();
}

/* ------------------------------------------------------------------- sync */

function schedulePush(key: string) {
  if (!isBrowser() || !ownerId) return;
  unsynced.add(key);
  const existing = timers.get(key);
  if (existing !== undefined) window.clearTimeout(existing);
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      void pushKey(key);
    }, PUSH_DEBOUNCE_MS),
  );
}

async function pushKey(key: string): Promise<boolean> {
  const client = supabaseClient();
  if (!client || !ownerId) return false;
  let value: unknown;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return true;
    value = JSON.parse(raw);
  } catch {
    return true;
  }
  const { error } = await client.from(TABLE).upsert(
    {
      owner_id: ownerId,
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,key" },
  );
  if (error) {
    scheduleRetry(key);
    return false;
  }
  unsynced.delete(key);
  retries.delete(key);
  if (status === "offline") setStatus("online");
  return true;
}

function scheduleRetry(key: string) {
  const attempt = retries.get(key) ?? 0;
  if (attempt >= RETRY_DELAYS_MS.length) return;
  retries.set(key, attempt + 1);
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
  const existing = timers.get(key);
  if (existing !== undefined) window.clearTimeout(existing);
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      void pushKey(key);
    }, delay),
  );
}

async function deleteRemote(key: string) {
  const client = supabaseClient();
  if (!client || !ownerId) return;
  const { error } = await client.from(TABLE).delete().eq("key", key);
  if (!error) unsynced.delete(key);
}

/** Re-send everything still waiting (used after reconnecting or on focus). */
export async function flushPendingWrites(): Promise<void> {
  if (!ownerId) return;
  const keys = [...unsynced];
  unsynced.clear();
  await Promise.all(keys.map((key) => pushKey(key)));
}

/** Make sure this browser has a Supabase user, signing in anonymously if not. */
async function ensureOwner(client: NonNullable<ReturnType<typeof supabaseClient>>) {
  const { data } = await client.auth.getSession();
  if (data.session?.user?.id) return data.session.user.id;
  const { data: created, error } = await client.auth.signInAnonymously();
  if (error || !created.user?.id) return null;
  return created.user.id;
}

type RemoteRow = { key: string; value: unknown; updated_at: string | null };

function applyRemote(row: RemoteRow) {
  const at = row.updated_at ? Date.parse(row.updated_at) : 0;
  try {
    window.localStorage.setItem(row.key, JSON.stringify(row.value ?? null));
  } catch {
    return;
  }
  writeStamp(row.key, Number.isFinite(at) ? at : Date.now());
}

async function hydrate() {
  const client = supabaseClient();
  if (!client) {
    setStatus("local");
    return;
  }
  let owner: string | null = null;
  try {
    owner = await ensureOwner(client);
  } catch {
    owner = null;
  }
  if (!owner) {
    // Anonymous sign-ins switched off, or the project is unreachable.
    setStatus("offline");
    return;
  }
  ownerId = owner;

  const { data, error } = await client
    .from(TABLE)
    .select("key, value, updated_at")
    .eq("owner_id", owner);

  if (error) {
    // Missing table / RLS denial: keep serving the on-device replica.
    setStatus("offline");
    return;
  }

  const remote = new Map<string, RemoteRow>();
  for (const row of (data ?? []) as RemoteRow[]) {
    if (row && typeof row.key === "string") remote.set(row.key, row);
  }

  for (const row of remote.values()) {
    const remoteAt = row.updated_at ? Date.parse(row.updated_at) : 0;
    const localAt = readStamp(row.key);
    // Only overwrite the replica when the cloud copy is genuinely newer, so a
    // change made while offline is not silently thrown away.
    if (!replicaHas(row.key) || remoteAt >= localAt) applyRemote(row);
  }

  const toPush = CLOUD_COLLECTIONS.filter((key) => {
    if (!replicaHas(key)) return false;
    const row = remote.get(key);
    if (!row) return true; // migration: this collection only ever lived locally
    const remoteAt = row.updated_at ? Date.parse(row.updated_at) : 0;
    return readStamp(key) > remoteAt;
  });

  setStatus("online");
  await Promise.all(toPush.map((key) => pushKey(key)));
}

/**
 * Start the cloud layer. Safe to call from any effect: it runs once, and the
 * result is cached so later mounts reuse the same promise.
 */
export function startCloudSync(): Promise<void> {
  if (!isBrowser()) return Promise.resolve();
  if (booting) return booting;
  booting = (async () => {
    bindBrowserEvents();
    try {
      await hydrate();
      const { loadSiteSettings } = await import("@/lib/site-settings");
      await loadSiteSettings();
    } catch {
      setStatus("offline");
    }
    notify();
  })();
  return booting;
}

function bindBrowserEvents() {
  if (bound || !isBrowser()) return;
  bound = true;
  // Another tab changed a collection: the replica changed underneath us.
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.startsWith(STAMP_PREFIX)) return;
    if (CLOUD_KEYS.has(event.key)) notify();
  });
  // Coming back online: push anything that failed while offline.
  window.addEventListener("online", () => {
    void startCloudSync().then(() => flushPendingWrites());
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushPendingWrites();
  });
}
