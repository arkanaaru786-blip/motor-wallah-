import { replicaRead } from "@/lib/cloud-store";
import { describeSupabaseError, supabaseClient, supabaseConfigured } from "@/lib/supabase";
import type { CustomerProfile } from "@/lib/account-store";

/**
 * Registered customers, for the master admin panel.
 *
 * Accounts are written by `lib/account-store.ts` into the
 * `mw_customer_profiles` collection (Supabase `app_records`), one row per
 * browser/owner, plus the `profiles` table from `supabase/schema.sql`. Staff
 * row-level-security policies let an admin read every row, so this loader
 * unions all three copies — the cloud collections, the `profiles` table and the
 * on-device replica, which is all that exists when the database is unreachable.
 *
 * Records are merged per person (mobile number, else email), keeping the
 * earliest registration date and filling any missing field from the other copy,
 * so the same customer saved twice never appears twice.
 */

const PROFILES_KEY = "mw_customer_profiles";
const RECORDS_TABLE = "app_records";
const PROFILES_TABLE = "profiles";

export type CustomerRow = {
  /** Stable key for React and search: mobile, else email. */
  id: string;
  name: string;
  mobile: string;
  email: string;
  city: string;
  createdAt: string | null;
};

export type CustomerSourceCounts = {
  records: number;
  profilesTable: number;
  local: number;
};

export type CustomerDirectoryResult = {
  rows: CustomerRow[];
  sources: CustomerSourceCounts;
  /** Set when a query failed for a reason other than a missing table. */
  error: string | null;
  /** True when neither cloud table could be read (setup pending / offline). */
  missing: boolean;
};

export const CUSTOMERS_SETUP_HINT =
  "No cloud copy of the customer list could be read. Run supabase/schema.sql in the Supabase SQL editor, then make sure the signed-in panel account is listed in the staff table. The customers saved on this device are still shown below.";

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, 200) : "";

const iso = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
};

const isMissingTable = (message: string) =>
  /does not exist|schema cache|relation .* not found|not found|404|PGRST205|42P01/i.test(message);

/** A partial person, as read from any one copy of the data. */
type ProfileFields = {
  name?: string | undefined;
  mobile?: string | undefined;
  email?: string | undefined;
  city?: string | undefined;
  createdAt?: string | null | undefined;
};

/** One merged person. */
type Bucket = {
  row: CustomerRow;
  /** Which copies contributed — used only to prefer the fuller record. */
  fields: number;
};

function mergeInto(map: Map<string, Bucket>, candidate: ProfileFields) {
  const mobile = text(candidate.mobile).replace(/\D/g, "").slice(-10);
  const email = text(candidate.email).toLowerCase();
  const name = text(candidate.name);
  const city = text(candidate.city);
  const createdAt = iso(candidate.createdAt);
  if (!mobile && !email) return;

  const id = mobile || email;
  const existing = map.get(id);
  if (!existing) {
    map.set(id, {
      row: {
        id,
        name: name || "Unnamed customer",
        mobile,
        email,
        city,
        createdAt,
      },
      fields: [name, mobile, email, city, createdAt].filter(Boolean).length,
    });
    return;
  }

  const row = existing.row;
  const fields = [name, mobile, email, city, createdAt].filter(Boolean).length;
  // Keep the earliest registration date: the first copy that knew the person.
  const earliest =
    row.createdAt && createdAt
      ? Date.parse(row.createdAt) <= Date.parse(createdAt)
        ? row.createdAt
        : createdAt
      : (row.createdAt ?? createdAt);

  map.set(id, {
    row: {
      id: row.id,
      name: row.name && row.name !== "Unnamed customer" ? row.name : name || row.name,
      mobile: row.mobile || mobile,
      email: row.email || email,
      city: row.city || city,
      createdAt: earliest,
    },
    fields: Math.max(existing.fields, fields),
  });
}

/** Profiles saved on this device (works offline, before any cloud read). */
function localProfiles(): ProfileFields[] {
  const raw = replicaRead<unknown>(PROFILES_KEY, {});
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
    const profile = (value ?? {}) as Partial<CustomerProfile>;
    return {
      name: profile.name,
      mobile: profile.mobile || (/^\d{10}$/.test(key) ? key : ""),
      email: profile.email,
      city: profile.city,
      createdAt: profile.createdAt,
    };
  });
}

/** Every `mw_customer_profiles` row, merged across owners. */
function recordsProfiles(values: unknown[]): ProfileFields[] {
  const out: ProfileFields[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const profile = (entry ?? {}) as Partial<CustomerProfile>;
      if (!profile || typeof profile !== "object") continue;
      out.push({
        name: profile.name,
        mobile: profile.mobile || (/^\d{10}$/.test(key) ? key : ""),
        email: profile.email,
        city: profile.city,
        createdAt: profile.createdAt,
      });
    }
  }
  return out;
}

export async function loadCustomers(): Promise<CustomerDirectoryResult> {
  const sources: CustomerSourceCounts = { records: 0, profilesTable: 0, local: 0 };
  const buckets = new Map<string, Bucket>();
  const errors: string[] = [];
  let cloudReadable = false;

  const local = localProfiles();
  sources.local = local.length;
  local.forEach((profile) => mergeInto(buckets, profile));

  const client = supabaseClient();
  if (client && supabaseConfigured) {
    // 1. The document store the app actually writes to.
    const records = await client
      .from(RECORDS_TABLE)
      .select("key,value,updated_at")
      .eq("key", PROFILES_KEY);
    if (records.error) {
      const message = describeSupabaseError(records.error);
      if (!isMissingTable(message)) errors.push(message);
    } else {
      cloudReadable = true;
      const rows = recordsProfiles((records.data ?? []).map((row) => row.value));
      sources.records = rows.length;
      rows.forEach((profile) => mergeInto(buckets, profile));
    }

    // 2. The dedicated profiles table, when the project has it.
    const table = await client
      .from(PROFILES_TABLE)
      .select("id,name,mobile,email,city,created_at")
      .limit(5000);
    if (table.error) {
      const message = describeSupabaseError(table.error);
      if (!isMissingTable(message)) errors.push(message);
    } else {
      cloudReadable = true;
      const rows = (table.data ?? []) as {
        name?: unknown;
        mobile?: unknown;
        email?: unknown;
        city?: unknown;
        created_at?: unknown;
      }[];
      sources.profilesTable = rows.length;
      rows.forEach((row) =>
        mergeInto(buckets, {
          name: text(row.name),
          mobile: text(row.mobile),
          email: text(row.email),
          city: text(row.city),
          createdAt: iso(row.created_at),
        }),
      );
    }
  }

  const rows = [...buckets.values()]
    .map((bucket) => bucket.row)
    .sort((a, b) => {
      const left = a.createdAt ? Date.parse(a.createdAt) : 0;
      const right = b.createdAt ? Date.parse(b.createdAt) : 0;
      return right - left || a.name.localeCompare(b.name);
    });

  return {
    rows,
    sources,
    error: errors.length ? errors[0]! : null,
    missing: !cloudReadable,
  };
}

/** `+91 98765 43210`, or an em dash when the account has no mobile yet. */
export function customerMobileLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length !== 10) return "—";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export const customerTelHref = (mobile: string): string | null =>
  mobile.replace(/\D/g, "").length >= 10 ? `tel:+91${mobile.replace(/\D/g, "").slice(-10)}` : null;
