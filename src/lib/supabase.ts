import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * The project only ever uses the publishable (anon) key, so the key is safe to
 * ship to the browser — row level security in `supabase/schema.sql` is what
 * protects the data, not the key's secrecy. VITE_SUPABASE_* takes precedence
 * when present (see .env.local) and the values below keep hosted builds
 * working even when no env file is configured.
 */
const FALLBACK_URL = "https://utsdgknpvsoqpnbueafh.supabase.co";
const FALLBACK_KEY = "sb_publishable_cr-1Rs4ToSVbpXwx9TQZKw_LDqFxHxe";

export const SUPABASE_URL: string = import.meta.env["VITE_SUPABASE_URL"] ?? FALLBACK_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? FALLBACK_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null = null;

/**
 * Browser-only singleton. Server rendering never touches the database: every
 * store in this project reads a synchronous on-device replica, and the replica
 * is filled in on the client after mount.
 */
export function supabaseClient(): SupabaseClient | null {
  if (!supabaseConfigured || typeof window === "undefined") return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "mw_supabase_auth",
      },
      global: { headers: { "x-application-name": "motor-wallah" } },
    });
  }
  return client;
}

/** Human-readable reason for a failed call, safe to show in the UI. */
export const describeSupabaseError = (error: unknown): string => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: string; code?: string; details?: string };
    const parts = [candidate.message, candidate.details].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
    if (candidate.code) return `Error ${candidate.code}`;
  }
  return "Unknown error";
};
