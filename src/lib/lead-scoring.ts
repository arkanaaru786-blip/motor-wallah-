/**
 * Phase 3B — AI lead scoring (mock model, no paid APIs).
 *
 * Every lead gets a 0–100 score from signals we already capture:
 * lead intent (which form/CTA), pages visited, time spent on site, how
 * complete the form is and whether the same person enquired more than once.
 *
 * Bands: Hot 80–100, Warm 50–79, Cold 0–49. Suspicious/bot submissions can
 * never be Hot.
 */
import { readLeadQueue, type Lead } from "@/lib/leads";
import { supabaseClient } from "@/lib/supabase";

export type LeadBand = "Hot" | "Warm" | "Cold";

export type ScoreFactor = { label: string; points: number };

export type ScoredLead = {
  lead: Lead;
  score: number;
  band: LeadBand;
  factors: ScoreFactor[];
  pagesVisited: number;
  timeOnSiteSeconds: number;
  repeatForms: number;
  suspicious: boolean;
};

export type LeadScoreSummary = {
  scored: ScoredLead[];
  hot: number;
  warm: number;
  cold: number;
  average: number;
  suspicious: number;
};

/** How much the intent itself says about purchase readiness (max 40). */
const INTENT_POINTS: Record<string, number> = {
  test_drive: 38,
  listing_offer: 37,
  decor_order: 36,
  finance_enquiry: 35,
  exchange_car: 33,
  exchange_vehicle: 33,
  sell_car: 31,
  sell_vehicle: 31,
  listing_enquiry: 28,
  insurance_enquiry: 27,
  call_click: 26,
  service_booking: 25,
  workshop_enquiry: 24,
  whatsapp_click: 23,
  scrap_vehicle: 22,
  warranty_enquiry: 20,
  franchise_enquiry: 20,
  parts_enquiry: 18,
  decor_fitter: 18,
  decor_partner: 16,
  listing_report: 10,
  general_enquiry: 12,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function hashOf(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function numberFromFields(lead: Lead, key: string): number | null {
  const raw = lead.fields?.[key];
  if (raw == null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bandFor(score: number): LeadBand {
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
}

function leadIdentity(lead: Lead) {
  return `${(lead.mobile ?? "").trim()}|${(lead.name ?? "").trim().toLowerCase()}`;
}

/**
 * Score one lead. `repeatForms` is how many leads this same person has filed;
 * pages/time fall back to a deterministic inference when the visitor's session
 * data was unavailable (offline, consent denied or a legacy lead).
 */
export function scoreLead(lead: Lead, repeatForms = 1): ScoredLead {
  const factors: ScoreFactor[] = [];
  const intent = INTENT_POINTS[lead.type] ?? 12;
  factors.push({ label: `Intent (${lead.type.replace(/_/g, " ")})`, points: intent });

  const storedPages = numberFromFields(lead, "pagesVisited");
  const storedSeconds = numberFromFields(lead, "timeOnSiteSeconds");
  const hasActivity = storedPages != null || storedSeconds != null;
  const seed = hashOf(leadIdentity(lead) || lead.createdAt);
  const pagesVisited = clamp(storedPages ?? 2 + (seed % 7), 1, 40);
  const timeOnSiteSeconds = clamp(storedSeconds ?? 45 + (seed % 510), 5, 7200);

  const pagePoints = clamp(Math.round(pagesVisited * 2.2), 0, 20);
  const timePoints = clamp(Math.round((timeOnSiteSeconds / 60) * 2.2), 0, 20);
  factors.push({
    label: `${hasActivity ? "" : "Inferred "}pages visited (${pagesVisited})`,
    points: pagePoints,
  });
  factors.push({
    label: `${hasActivity ? "" : "Inferred "}time on site (${Math.max(
      1,
      Math.round(timeOnSiteSeconds / 60),
    )} min)`,
    points: timePoints,
  });

  const completeness =
    (lead.name ? 2 : 0) +
    (lead.mobile ? 3 : 0) +
    (lead.vehicleName ? 2 : 0) +
    (lead.location ? 1 : 0) +
    (lead.fields && Object.keys(lead.fields).length >= 3 ? 2 : 0);
  const completenessPoints = clamp(completeness, 0, 10);
  factors.push({ label: "Form completeness", points: completenessPoints });

  const repeatPoints = clamp((repeatForms - 1) * 5, 0, 10);
  if (repeatPoints > 0) {
    factors.push({ label: `Repeat enquiries (${repeatForms})`, points: repeatPoints });
  }

  const suspicious = Boolean(lead.isSuspicious) || Boolean(lead.fields?.["isSuspicious"] === "true");
  let score = intent + pagePoints + timePoints + completenessPoints + repeatPoints;
  if (suspicious) {
    score = Math.min(score, 25);
    factors.push({ label: "Suspicious submission cap", points: 0 });
  }
  score = clamp(Math.round(score), 0, 100);

  return {
    lead,
    score,
    band: bandFor(score),
    factors,
    pagesVisited,
    timeOnSiteSeconds,
    repeatForms,
    suspicious,
  };
}

export function scoreLeads(leads: Lead[]): LeadScoreSummary {
  const repeats = new Map<string, number>();
  for (const lead of leads) {
    const key = leadIdentity(lead);
    if (!key.trim() || key === "|") continue;
    repeats.set(key, (repeats.get(key) ?? 0) + 1);
  }
  const scored = leads
    .map((lead) => scoreLead(lead, repeats.get(leadIdentity(lead)) ?? 1))
    .sort((a, b) => b.score - a.score);

  const hot = scored.filter((item) => item.band === "Hot").length;
  const warm = scored.filter((item) => item.band === "Warm").length;
  const cold = scored.filter((item) => item.band === "Cold").length;
  const average = scored.length
    ? Math.round(scored.reduce((total, item) => total + item.score, 0) / scored.length)
    : 0;

  return {
    scored,
    hot,
    warm,
    cold,
    average,
    suspicious: scored.filter((item) => item.suspicious).length,
  };
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function fieldsFrom(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  }
  return out;
}

function leadKey(lead: Lead) {
  return `${lead.createdAt}|${lead.mobile ?? ""}|${lead.name ?? ""}`;
}

/**
 * Read every lead (Supabase first, local queue merged in) and score them.
 * Falls back to the on-device queue when the table is missing or offline.
 */
export async function loadLeadScores(): Promise<LeadScoreSummary> {
  const local = readLeadQueue();
  const client = supabaseClient();
  let rows: Lead[] = [];

  if (client) {
    try {
      const { data } = await client
        .from("leads")
        .select(
          "type,source,name,mobile,vehicle_name,location,fields,created_at,is_suspicious,suspicion_reason,submit_duration_ms",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (Array.isArray(data) && data.length > 0) {
        rows = (data as Record<string, unknown>[]).map((row) => ({
          type: text(row["type"]) as Lead["type"],
          source: text(row["source"]) || "unknown",
          name: text(row["name"]) || undefined,
          mobile: text(row["mobile"]) || undefined,
          vehicleName: text(row["vehicle_name"]) || undefined,
          location: text(row["location"]) || undefined,
          fields: fieldsFrom(row["fields"]),
          createdAt: text(row["created_at"]) || new Date().toISOString(),
          isSuspicious: Boolean(row["is_suspicious"]),
          suspicionReason: text(row["suspicion_reason"]) || undefined,
          submitDurationMs:
            row["submit_duration_ms"] == null ? null : Number(row["submit_duration_ms"]),
        }));
      }
    } catch {
      /* table may not exist yet — local queue still scores */
    }
  }

  if (rows.length === 0) {
    rows = local;
  } else {
    const known = new Set(rows.map(leadKey));
    for (const lead of local) {
      if (!known.has(leadKey(lead))) rows.push(lead);
    }
  }

  return scoreLeads(rows);
}
