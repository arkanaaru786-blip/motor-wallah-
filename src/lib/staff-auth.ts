import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  describeSupabaseError,
  supabaseConfigured,
} from "@/lib/supabase";

/**
 * Staff sign-in.
 *
 * Editing site settings is a staff-only write (`is_staff()` in
 * supabase/fix-rls.sql), so the admin panel needs a Supabase session that really
 * belongs to a staff member. It deliberately does **not** reuse the visitor
 * client from `supabase.ts`: that one holds the anonymous session which owns the
 * cart, shortlist and chats, and swapping its identity for a staff login would
 * strand every row already written under the visitor's id.
 *
 * So this is a second, separate client with its own storage key. Signing in here
 * gives the admin panel a staff JWT for privileged reads and writes while the
 * public site keeps its anonymous session untouched.
 */
let client: SupabaseClient | null = null;

const STAFF_STORAGE_KEY = "mw_staff_auth";

/** True when this browser has a staff session stored (a UI hint, not a check). */
export const STAFF_SESSION_KEY = STAFF_STORAGE_KEY;

export function staffClient(): SupabaseClient | null {
  if (!supabaseConfigured || typeof window === "undefined") return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STAFF_STORAGE_KEY,
      },
      global: { headers: { "x-application-name": "motor-wallah-staff" } },
    });
  }
  return client;
}

export type StaffState = {
  email: string;
  /** Whether the signed-in Supabase user is listed in public.staff. */
  isStaff: boolean;
};

/** The signed-in staff user, or null when nobody is signed in. */
export async function currentStaff(): Promise<StaffState | null> {
  const supabase = staffClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email ?? "";
  if (!email) return null;

  const { data: staff, error } = await supabase.rpc("is_staff");
  if (error) return { email, isStaff: false };
  return { email, isStaff: Boolean(staff) };
}

export async function staffSignIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; isStaff?: boolean }> {
  const supabase = staffClient();
  if (!supabase) return { ok: false, error: "The database is not configured for this build." };

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const message = describeSupabaseError(error);
    const friendly = /invalid login credentials/i.test(message)
      ? "That email and password do not match a user in this project."
      : /email not confirmed/i.test(message)
        ? "That account still needs its email confirmed in the Supabase dashboard."
        : message;
    return { ok: false, error: friendly };
  }

  const state = await currentStaff();
  return { ok: true, isStaff: state?.isStaff ?? false };
}

export async function staffSignOut(): Promise<void> {
  await staffClient()?.auth.signOut();
}

/** Whether the current staff session may write settings (true only for staff). */
export async function staffMayWrite(): Promise<boolean> {
  return (await currentStaff())?.isStaff ?? false;
}
