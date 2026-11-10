/**
 * Phase 3B — live visitor feed for the admin map.
 *
 * Reads the Phase 3A `visitor_sessions` rows, treats anything seen in the last
 * five minutes as "live", and resolves the captured city to coordinates for a
 * free OpenStreetMap/Leaflet map. No geocoding API and no paid service: the
 * lookup table is local, and unresolved cities are counted rather than guessed.
 */
import { supabaseClient } from "@/lib/supabase";

export type VisitorPin = {
  id: string;
  city: string;
  lat: number;
  lng: number;
  device: string;
  browser: string;
  source: string;
  pages: number;
  lastSeenAt: string;
  landingPath: string | null;
  live: boolean;
  demo: boolean;
};

export type LiveVisitorFeed = {
  pins: VisitorPin[];
  liveCount: number;
  recentCount: number;
  unresolved: number;
  demo: boolean;
  note: string;
  checkedAt: string;
};

/** Coordinates for the Indian cities captured by ipapi.co. */
const CITY_COORDS: Record<string, [number, number]> = {
  mumbai: [19.076, 72.8777],
  "navi mumbai": [19.033, 73.0297],
  thane: [19.2183, 72.9781],
  pune: [18.5204, 73.8567],
  nashik: [19.9975, 73.7898],
  nagpur: [21.1458, 79.0882],
  aurangabad: [19.8762, 75.3433],
  kolhapur: [16.705, 74.2433],
  delhi: [28.6139, 77.209],
  "new delhi": [28.6139, 77.209],
  gurugram: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  noida: [28.5355, 77.391],
  faridabad: [28.4089, 77.3178],
  ghaziabad: [28.6692, 77.4538],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mysuru: [12.2958, 76.6394],
  hyderabad: [17.385, 78.4867],
  secunderabad: [17.4399, 78.4983],
  warangal: [17.9689, 79.5941],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  tiruchirappalli: [10.7905, 78.7047],
  kolkata: [22.5726, 88.3639],
  howrah: [22.5958, 88.2636],
  siliguri: [26.7271, 88.3953],
  ahmedabad: [23.0225, 72.5714],
  surat: [21.1702, 72.8311],
  vadodara: [22.3072, 73.1812],
  rajkot: [22.3039, 70.8022],
  jaipur: [26.9124, 75.7873],
  jodhpur: [26.2389, 73.0243],
  udaipur: [24.5854, 73.7125],
  lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319],
  varanasi: [25.3176, 82.9739],
  agra: [27.1767, 78.0081],
  patna: [25.5941, 85.1376],
  ranchi: [23.3441, 85.3096],
  bhopal: [23.2599, 77.4126],
  indore: [22.7196, 75.8577],
  jabalpur: [23.1815, 79.9864],
  gwalior: [26.2183, 78.1828],
  raipur: [21.2514, 81.6296],
  chandigarh: [30.7333, 76.7794],
  ludhiana: [30.901, 75.8573],
  amritsar: [31.634, 74.8723],
  dehradun: [30.3165, 78.0322],
  jammu: [32.7266, 74.857],
  srinagar: [34.0837, 74.7973],
  guwahati: [26.1445, 91.7362],
  bhubaneswar: [20.2961, 85.8245],
  cuttack: [20.4625, 85.883],
  visakhapatnam: [17.6868, 83.2185],
  vijayawada: [16.5062, 80.648],
  kochi: [9.9312, 76.2673],
  cochin: [9.9312, 76.2673],
  thiruvananthapuram: [8.5241, 76.9366],
  kozhikode: [11.2588, 75.7804],
  goa: [15.2993, 74.124],
  panaji: [15.4909, 73.8278],
  mangaluru: [12.9141, 74.856],
  shimla: [31.1048, 77.1734],
  pondicherry: [11.9416, 79.8083],
  puducherry: [11.9416, 79.8083],
};

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function hash(value: string) {
  let out = 0;
  for (let index = 0; index < value.length; index++) {
    out = (out * 31 + value.charCodeAt(index)) % 100000;
  }
  return out;
}

/** Deterministic small offset so two visitors in one city don't stack. */
function jitter(id: string): [number, number] {
  const seed = hash(id);
  return [((seed % 100) / 100 - 0.5) * 0.32, (((seed / 100) | 0) % 100) / 100 - 0.5] as [
    number,
    number,
  ];
}

function cityKey(city: string) {
  return city
    .split(",")[0]!
    .trim()
    .toLowerCase()
    .replace(/[.]/g, "");
}

export function coordsForCity(city: string): [number, number] | null {
  if (!city) return null;
  return CITY_COORDS[cityKey(city)] ?? null;
}

const DEMO_VISITORS: { city: string; device: string; browser: string; source: string }[] = [
  { city: "Mumbai", device: "Mobile", browser: "Chrome", source: "Instagram" },
  { city: "Delhi", device: "Desktop", browser: "Chrome", source: "Google" },
  { city: "Bengaluru", device: "Mobile", browser: "Safari", source: "Direct" },
  { city: "Hyderabad", device: "Mobile", browser: "Chrome", source: "Instagram" },
  { city: "Pune", device: "Desktop", browser: "Edge", source: "Google" },
  { city: "Chennai", device: "Mobile", browser: "Chrome", source: "WhatsApp" },
  { city: "Jaipur", device: "Mobile", browser: "Chrome", source: "Direct" },
  { city: "Ahmedabad", device: "Tablet", browser: "Safari", source: "Google" },
];

function demoFeed(): LiveVisitorFeed {
  const now = new Date().toISOString();
  const pins: VisitorPin[] = DEMO_VISITORS.flatMap((visitor, index) => {
    const coords = coordsForCity(visitor.city);
    if (!coords) return [];
    const [dLat, dLng] = jitter(`demo-${visitor.city}`);
    return [
      {
        id: `demo-${index}`,
        city: visitor.city,
        lat: coords[0] + dLat,
        lng: coords[1] + dLng,
        device: visitor.device,
        browser: visitor.browser,
        source: visitor.source,
        pages: 2 + (index % 4),
        lastSeenAt: now,
        landingPath: "/buy",
        live: true,
        demo: true,
      },
    ];
  });
  return {
    pins,
    liveCount: pins.length,
    recentCount: 0,
    unresolved: 0,
    demo: true,
    note: "No visitor sessions recorded yet — showing a sample distribution until real traffic arrives.",
    checkedAt: now,
  };
}

type SessionRow = {
  session_id?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  source?: string | null;
  page_views?: number | null;
  last_seen_at?: string | null;
  landing_path?: string | null;
};

export async function loadLiveVisitorFeed(): Promise<LiveVisitorFeed> {
  const client = supabaseClient();
  if (!client) return demoFeed();

  let rows: SessionRow[] = [];
  try {
    const { data } = await client
      .from("visitor_sessions")
      .select("session_id,city,device,browser,source,page_views,last_seen_at,landing_path")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (Array.isArray(data)) rows = data as SessionRow[];
  } catch {
    /* table may not exist yet */
  }

  if (rows.length === 0) return demoFeed();

  const now = Date.now();
  const pins: VisitorPin[] = [];
  let liveCount = 0;
  let recentCount = 0;
  let unresolved = 0;

  for (const row of rows) {
    const city = String(row.city ?? "").trim();
    const lastSeen = Date.parse(String(row.last_seen_at ?? ""));
    if (!Number.isFinite(lastSeen)) continue;
    const age = now - lastSeen;
    if (age > RECENT_WINDOW_MS) continue;
    const coords = coordsForCity(city);
    if (!coords) {
      unresolved += 1;
      continue;
    }
    const live = age <= LIVE_WINDOW_MS;
    if (live) liveCount += 1;
    else recentCount += 1;
    const id = String(row.session_id ?? `${city}-${lastSeen}`);
    const [dLat, dLng] = jitter(id);
    pins.push({
      id,
      city: city || "Unknown",
      lat: coords[0] + dLat,
      lng: coords[1] + dLng,
      device: String(row.device ?? "Unknown"),
      browser: String(row.browser ?? "Unknown"),
      source: String(row.source ?? "Direct"),
      pages: Number(row.page_views ?? 1),
      lastSeenAt: new Date(lastSeen).toISOString(),
      landingPath: row.landing_path ? String(row.landing_path) : null,
      live,
      demo: false,
    });
  }

  if (pins.length === 0) {
    const empty = demoFeed();
    return {
      ...empty,
      unresolved,
      note:
        unresolved > 0
          ? "Visits were recorded but their cities could not be resolved — showing a sample distribution."
          : empty.note,
    };
  }

  pins.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return a.lastSeenAt < b.lastSeenAt ? 1 : -1;
  });

  return {
    pins,
    liveCount,
    recentCount,
    unresolved,
    demo: false,
    note: liveCount
      ? `${liveCount} visitor${liveCount === 1 ? "" : "s"} active in the last 5 minutes${
          recentCount ? `, ${recentCount} more in the last 24 hours` : ""
        }.`
      : `No one is active this minute — showing ${recentCount} visit${recentCount === 1 ? "" : "s"} from the last 24 hours.`,
    checkedAt: new Date().toISOString(),
  };
}
