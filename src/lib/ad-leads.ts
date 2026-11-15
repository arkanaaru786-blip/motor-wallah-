import { describeSupabaseError, supabaseClient } from "@/lib/supabase";
import { staffClient, staffSession } from "@/lib/staff-auth";
import type { Banner } from "@/lib/banners";

/**
 * Ad click leads.
 *
 * A visitor who clicks an advertisement gets the enquiry form instead of being
 * sent straight to the advertiser's site. Their name, mobile and requirement are
 * written to `ad_leads` (see supabase/ad-leads.sql), the advertiser is notified
 * by email (and WhatsApp when the server has credentials), and the Master
 * Control room reads the same rows in its Ad Leads tab.
 *
 * Capture must never be blocked by a missing schema: when the table has not
 * been created yet the dialog says so plainly, exactly like Banners & Ads does.
 */

export type AdLeadStatus = "New" | "Contacted" | "Closed";

export const AD_LEAD_STATUSES: AdLeadStatus[] = ["New", "Contacted", "Closed"];

export type AdLead = {
  id: string;
  bannerSection: string;
  bannerTitle: string;
  advertiserName: string;
  advertiserEmail: string;
  advertiserWhatsapp: string;
  name: string;
  mobile: string;
  requirement: string;
  sourcePath: string;
  status: AdLeadStatus;
  createdAt: string;
};

export const AD_LEADS_SETUP_HINT =
  "The ad_leads table is not in this database yet. Run supabase/ad-leads.sql in the Supabase SQL editor, then reload this page.";

export const SECTION_LABELS: Record<string, string> = {
  home_top: "Homepage top banner",
  franchise_banner: "Franchise banner",
  business_spotlight: "Business spotlight",
  sidebar: "BUY sidebar ad",
  sidebar_slot_1: "Homepage sidebar ad 1",
  sidebar_slot_2: "Homepage sidebar ad 2",
};

export const sectionLabel = (section: string): string =>
  SECTION_LABELS[section] ?? section.replace(/_/g, " ");

/** PostgREST reports a missing relation (or a missing table in the schema cache). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|could not find the table|schema cache/i.test(error.message ?? "");
}

export type AdLeadInput = {
  banner: Banner;
  name: string;
  mobile: string;
  requirement: string;
  sourcePath: string;
};

/** Store one enquiry. Anonymous visitors may insert; nobody anonymous may read. */
export async function submitAdLead(input: AdLeadInput): Promise<{ ok: boolean; error?: string }> {
  const client = supabaseClient();
  if (!client) {
    return {
      ok: false,
      error: "The enquiry service is not configured for this build, so nothing was saved.",
    };
  }

  const { error } = await client.from("ad_leads").insert({
    banner_section: input.banner.section,
    banner_title: input.banner.title,
    advertiser_name: input.banner.advertiserName,
    advertiser_email: input.banner.advertiserEmail,
    advertiser_whatsapp: input.banner.advertiserWhatsapp,
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    requirement: input.requirement.trim(),
    source_path: input.sourcePath,
  });

  if (error) {
    return {
      ok: false,
      error: isMissingTable(error)
        ? AD_LEADS_SETUP_HINT
        : `${describeSupabaseError(error)} — the enquiry was not saved.`,
    };
  }
  return { ok: true };
}

/**
 * Ask the server to notify the advertiser. Fire and forget: the lead is already
 * saved by this point, so a failed notification must not fail the form.
 */
export async function notifyAdvertiser(input: {
  banner: Banner;
  name: string;
  mobile: string;
  requirement: string;
  sourcePath: string;
}): Promise<void> {
  try {
    await fetch("/api/ad-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: input.banner.section,
        name: input.name.trim(),
        mobile: input.mobile.trim(),
        requirement: input.requirement.trim(),
        sourcePath: input.sourcePath,
      }),
    });
  } catch {
    /* offline — the lead is stored and appears in Ad Leads regardless */
  }
}

const COLUMNS =
  "id, banner_section, banner_title, advertiser_name, advertiser_email, advertiser_whatsapp, name, mobile, requirement, source_path, status, created_at";

type Row = {
  id: string;
  banner_section: string;
  banner_title: string | null;
  advertiser_name: string | null;
  advertiser_email: string | null;
  advertiser_whatsapp: string | null;
  name: string;
  mobile: string;
  requirement: string | null;
  source_path: string | null;
  status: string | null;
  created_at: string;
};

const rowToLead = (row: Row): AdLead => ({
  id: row.id,
  bannerSection: row.banner_section,
  bannerTitle: row.banner_title ?? "",
  advertiserName: row.advertiser_name ?? "",
  advertiserEmail: row.advertiser_email ?? "",
  advertiserWhatsapp: row.advertiser_whatsapp ?? "",
  name: row.name,
  mobile: row.mobile,
  requirement: row.requirement ?? "",
  sourcePath: row.source_path ?? "",
  status: row.status === "Contacted" || row.status === "Closed" ? row.status : "New",
  createdAt: row.created_at,
});

export type AdLeadsResult = {
  leads: AdLead[];
  /** True when the table has not been created yet. */
  missing: boolean;
  error: string | null;
};

/** Staff-only read for the control room. Newest first. */
export async function loadAdLeads(): Promise<AdLeadsResult> {
  const client = staffClient();
  if (!client) {
    return { leads: [], missing: false, error: "The database is not configured for this build." };
  }
  await staffSession();

  const { data, error } = await client
    .from("ad_leads")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTable(error)) return { leads: [], missing: true, error: AD_LEADS_SETUP_HINT };
    return { leads: [], missing: false, error: describeSupabaseError(error) };
  }
  return { leads: ((data ?? []) as Row[]).map(rowToLead), missing: false, error: null };
}

/** Move a lead through New → Contacted → Closed. Staff-only at the database. */
export async function setAdLeadStatus(
  id: string,
  status: AdLeadStatus,
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client.from("ad_leads").update({ status }).eq("id", id);
  if (error) return { ok: false, error: describeSupabaseError(error) };
  return { ok: true };
}

const digits = (value: string) => value.replace(/[^\d]/g, "");

/** A tel: link for the number the customer left. */
export const telHref = (mobile: string): string => `tel:${mobile.replace(/[^\d+]/g, "")}`;

/** WhatsApp the customer who submitted the lead. */
export function customerWhatsAppHref(lead: AdLead): string {
  const number = digits(lead.mobile);
  const message = `Hi ${lead.name}, this is Motor Wallah about your enquiry for the ${lead.bannerTitle || sectionLabel(lead.bannerSection)} advertisement.`;
  return `https://wa.me/${number.length === 10 ? `91${number}` : number}?text=${encodeURIComponent(message)}`;
}

/**
 * Forward the lead to the advertiser on WhatsApp. This is the manual channel
 * used when the server has no WhatsApp Cloud API credentials (or alongside the
 * automatic message): it opens WhatsApp with the details already written.
 */
export function advertiserWhatsAppHref(lead: AdLead): string | null {
  const raw = lead.advertiserWhatsapp.trim();
  if (!raw) return null;
  const number = digits(raw.replace(/^https?:\/\/wa\.me\//i, ""));
  if (!number) return null;
  const message = [
    `New enquiry for your Motor Wallah ad "${lead.bannerTitle || sectionLabel(lead.bannerSection)}".`,
    `Name: ${lead.name}`,
    `Mobile: ${lead.mobile}`,
    lead.requirement ? `Requirement: ${lead.requirement}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${number.length === 10 ? `91${number}` : number}?text=${encodeURIComponent(message)}`;
}

export const advertiserEmailHref = (lead: AdLead): string | null => {
  const email = lead.advertiserEmail.trim();
  if (!email) return null;
  const subject = `New enquiry from ${lead.name} — Motor Wallah ad`;
  const body = [
    `Name: ${lead.name}`,
    `Mobile: ${lead.mobile}`,
    `Requirement: ${lead.requirement || "Not specified"}`,
    `Ad: ${lead.bannerTitle || sectionLabel(lead.bannerSection)}`,
    `Received: ${new Date(lead.createdAt).toLocaleString("en-IN")}`,
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const shortAdLeadTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
