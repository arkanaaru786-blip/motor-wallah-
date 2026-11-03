import { supabaseClient, describeSupabaseError } from "@/lib/supabase";
import { staffClient } from "@/lib/staff-auth";
import { applySiteSettings } from "@/lib/site";

/**
 * Site settings (support phone, WhatsApp line, support inbox).
 *
 * These used to be hard-coded constants in src/lib/site.ts. The constants are
 * still the fallback, but the live values now come from the `site_settings`
 * table in Supabase so the team can change a number without a redeploy. The
 * table is world-readable and staff-writable (see supabase/schema.sql).
 */
export type SiteSettings = {
  phoneDisplay: string;
  phoneHref: string;
  whatsappBase: string;
  supportEmail: string;
};

export const SETTINGS_KEYS = {
  phoneDisplay: "phone_display",
  phoneHref: "phone_href",
  whatsappBase: "whatsapp_base",
  supportEmail: "support_email",
} as const;

type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Reads site_settings and applies it to the live values exported by site.ts. */
export async function loadSiteSettings(): Promise<Partial<SiteSettings> | null> {
  const client = supabaseClient();
  if (!client) return null;
  const { data, error } = await client.from("site_settings").select("key, value");
  if (error || !data) return null;

  const read = (key: SettingKey): string | undefined => {
    const row = data.find((entry) => (entry as { key?: string }).key === key);
    const value = (row as { value?: unknown } | undefined)?.value;
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "value" in (value as object)) {
      const inner = (value as { value?: unknown }).value;
      if (typeof inner === "string") return inner;
    }
    return undefined;
  };

  const settings: Partial<SiteSettings> = {};
  const phoneDisplay = read(SETTINGS_KEYS.phoneDisplay);
  const phoneHref = read(SETTINGS_KEYS.phoneHref);
  const whatsappBase = read(SETTINGS_KEYS.whatsappBase);
  const supportEmail = read(SETTINGS_KEYS.supportEmail);
  if (phoneDisplay) settings.phoneDisplay = phoneDisplay;
  if (phoneHref) settings.phoneHref = phoneHref;
  if (whatsappBase) settings.whatsappBase = whatsappBase;
  if (typeof supportEmail === "string") settings.supportEmail = supportEmail;
  applySiteSettings(settings);
  return settings;
}

/**
 * Save one or more settings. Writes are allowed for signed-in staff only
 * (`is_staff()` in the schema), so they go through the staff client — the
 * visitor's anonymous session must keep owning the public data. Without a staff
 * sign-in the database refuses the write and the panel shows why.
 */
export async function saveSiteSettings(
  patch: Partial<SiteSettings>,
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };

  const rows = (Object.keys(SETTINGS_KEYS) as (keyof SiteSettings)[])
    .filter((field) => typeof patch[field] === "string")
    .map((field) => ({
      key: SETTINGS_KEYS[field],
      value: patch[field] as string,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return { ok: true };

  const { error } = await client.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error)
    return {
      ok: false,
      error: `${describeSupabaseError(error)} — sign in below with a staff account, then save again.`,
    };
  applySiteSettings(patch);
  return { ok: true };
}
