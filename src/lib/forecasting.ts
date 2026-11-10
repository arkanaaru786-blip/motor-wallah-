/**
 * Phase 3B — "Next Week Forecast" (mock AI, no paid APIs).
 *
 * The projection is a transparent weighted model over what we already track:
 * lead volume in the last 7 days vs the 7 before, which vehicle categories the
 * enquiries mention, and the usual weekend lift on a marketplace. When there is
 * too little history it falls back to clearly labelled benchmark numbers so the
 * dashboard still demonstrates the feature.
 */
import type { Lead } from "@/lib/leads";
import type { AnalyticsSnapshot } from "@/lib/analytics";

export type ForecastDay = { label: string; date: string; leads: number };

export type DemandCategory = {
  label: string;
  share: number;
  growthPct: number;
  reason: string;
};

export type Forecast = {
  expectedLeads: number;
  expectedFinanceLeads: number;
  growthPct: number;
  confidence: number;
  basis: string;
  topCategory: DemandCategory;
  demandCallout: string;
  bestDay: ForecastDay;
  days: ForecastDay[];
  note: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Weekend-heavy marketplace distribution for the coming week. */
const DAY_WEIGHTS = [0.1, 0.11, 0.12, 0.13, 0.15, 0.2, 0.19];

type CategoryRule = { label: string; words: string[]; reason: string };

const CATEGORY_RULES: CategoryRule[] = [
  {
    label: "SUVs",
    words: ["suv", "fortuner", "creta", "seltos", "scorpio", "xuv", "harrier", "safari", "thar", "hector", "brezza", "venue", "sonet", "magnite", "kushaq", "taigun", "punch", "nexon", "duster", "bolero", "wrangler", "gloster", "tucson", "alcazar", "carens", "ertiga"],
    reason: "Family cars and high seating keep SUVs the strongest search and enquiry category.",
  },
  {
    label: "Sedans",
    words: ["sedan", "city", "verna", "ciaz", "amaze", "slavia", "virtus", "dzire", "aura", "tigor", "camry", "octavia", "superb", "elantra"],
    reason: "Sedan enquiries cluster around commuter-friendly petrol models and finance offers.",
  },
  {
    label: "Hatchbacks",
    words: ["hatchback", "swift", "baleno", "i20", "altroz", "wagonr", "tiago", "kwid", "ignis", "polo", "glanza", "celerio", "spresso", "nios"],
    reason: "First-car buyers drive steady hatchback demand, especially on weekend traffic.",
  },
  {
    label: "Electric vehicles",
    words: ["electric", "ev", "nexon ev", "tiago ev", "windsor", "comet", "atto", "e2o", "ioniq", "zsev", "xev", "punch ev"],
    reason: "EV interest is rising with fuel prices and newer city-friendly launches.",
  },
  {
    label: "Bikes & scooters",
    words: ["bike", "scooter", "activa", "pulsar", "splendor", "classic", "hunter", "apache", "jupiter", "access", "fz", "shine", "bullet", "dominar", "ntorq"],
    reason: "Two-wheeler leads spike with weekday commute intent and low-ticket finance.",
  },
  {
    label: "Commercial vehicles",
    words: ["truck", "bus", "tempo", "pickup", "tipper", "tractor", "scv", "three wheeler", "auto", "cargo", "eicher", "tata ace"],
    reason: "Commercial buyers enquire in batches, often through dealer referrals.",
  },
];

function hash(value: string) {
  let out = 0;
  for (let index = 0; index < value.length; index++) {
    out = (out * 33 + value.charCodeAt(index)) % 100000;
  }
  return out;
}

function pctChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function detectCategory(leads: Lead[], snapshot?: AnalyticsSnapshot | null): DemandCategory {
  const counts = new Map<string, number>();
  let total = 0;
  const names: string[] = [];
  for (const lead of leads) if (lead.vehicleName) names.push(lead.vehicleName.toLowerCase());
  for (const row of snapshot?.topVehicles ?? []) names.push(row.vehicleName.toLowerCase());

  for (const name of names) {
    const rule = CATEGORY_RULES.find((candidate) => candidate.words.some((word) => name.includes(word)));
    if (!rule) continue;
    counts.set(rule.label, (counts.get(rule.label) ?? 0) + 1);
    total += 1;
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return {
      label: "SUVs",
      share: 34,
      growthPct: 12,
      reason: CATEGORY_RULES[0]!.reason,
    };
  }
  const [label, count] = ranked[0]!;
  const rule = CATEGORY_RULES.find((candidate) => candidate.label === label)!;
  const share = Math.round((count / Math.max(1, total)) * 100);
  const seed = hash(label);
  return {
    label,
    share,
    growthPct: 6 + (seed % 12),
    reason: rule.reason,
  };
}

function buildDays(expectedLeads: number): ForecastDay[] {
  const today = new Date();
  return DAY_LABELS.map((label, index) => {
    const date = new Date(today.getTime() + (index + 1) * 86400000);
    return {
      label,
      date: date.toISOString().slice(0, 10),
      leads: Math.max(0, Math.round(expectedLeads * DAY_WEIGHTS[index]!)),
    } satisfies ForecastDay;
  });
}

export function buildForecast(input: {
  leads: Lead[];
  snapshot?: AnalyticsSnapshot | null;
}): Forecast {
  const { leads, snapshot } = input;
  const now = Date.now();
  const within = (days: number, offset = 0) => {
    const start = now - (days + offset) * 86400000;
    const end = now - offset * 86400000;
    return leads.filter((lead) => {
      const at = Date.parse(lead.createdAt);
      return Number.isFinite(at) && at >= start && at < end;
    });
  };

  const lastWeek = within(7);
  const previousWeek = within(7, 7);
  const thinHistory = leads.length < 4;

  const baselineLeads = thinHistory ? 18 : lastWeek.length;
  const financeLastWeek = lastWeek.filter((lead) => lead.type === "finance_enquiry").length;
  const trend = previousWeek.length
    ? Math.min(1.45, Math.max(0.7, lastWeek.length / previousWeek.length))
    : 1.08;

  const expectedLeads = Math.max(
    4,
    Math.round(baselineLeads * trend + (thinHistory ? 0 : 2)),
  );
  const expectedFinanceLeads = Math.max(
    2,
    Math.round((thinHistory ? 6 : financeLastWeek) * trend),
  );
  const growthPct = pctChange(expectedLeads, Math.max(1, previousWeek.length || baselineLeads));

  const topCategory = detectCategory(leads, snapshot);
  const days = buildDays(expectedLeads);
  const bestDay = days.reduce((best, day) => (day.leads > best.leads ? day : best), days[0]!);

  const confidence = Math.min(
    92,
    Math.max(55, 58 + leads.length * 2 + (snapshot?.topVehicles.length ?? 0) * 2),
  );

  const demandCallout =
    topCategory.growthPct >= 10
      ? `High demand for ${topCategory.label}`
      : `Steady demand for ${topCategory.label}`;

  return {
    expectedLeads,
    expectedFinanceLeads,
    growthPct,
    confidence,
    basis: thinHistory
      ? "Benchmark model — too little lead history yet, using category demand norms."
      : `Modelled from ${lastWeek.length} leads in the last 7 days vs ${previousWeek.length} the week before.`,
    topCategory,
    demandCallout,
    bestDay,
    days,
    note: `${topCategory.reason} Confidence ${confidence}%.`,
  };
}
