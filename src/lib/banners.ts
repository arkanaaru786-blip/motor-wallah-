import { useEffect, useState } from "react";
import { describeSupabaseError, supabaseClient } from "@/lib/supabase";
import { staffAccessToken, staffClient, staffSession } from "@/lib/staff-auth";

/**
 * Dynamic banners and ads.
 *
 * Every ad slot on the site is one row in the `banners` table (see
 * supabase/banners.sql). The marketing team uploads the artwork and sets the
 * link from the control room, so nothing here is baked into the build.
 *
 * Two rules shape this module:
 *
 *  - The public site must never break because of an ad. Reads fall back to the
 *    bundled artwork when a slot is empty, inactive, or the table has not been
 *    created yet, and `bannersStatus()` is how a screen says so out loud.
 *  - Writes are staff-only. Uploads and row edits go through `staffClient()`,
 *    the Supabase session signed in with a real staff password — the visitor's
 *    anonymous session may only read the rows and add a click.
 */

export const BANNER_SECTIONS = [
  {
    id: "home_top",
    label: "Homepage top banner",
    where: "Full-width strip under the category row on the homepage.",
    wide: true,
    multiple: false,
  },
  {
    id: "franchise_banner",
    label: "Franchise banner",
    where: "The image beside “Become a Franchise Partner” on the homepage.",
    wide: false,
    multiple: false,
  },
  {
    id: "business_spotlight",
    label: "Business spotlight",
    where: "The sponsored brand card on the homepage.",
    wide: true,
    multiple: false,
  },
  {
    id: "sidebar",
    label: "BUY sidebar ad",
    where: "Tall card under the filters in the BUY marketplace.",
    wide: false,
    multiple: false,
  },
  {
    id: "sidebar_slot_1",
    label: "Homepage sidebar ad 1",
    where:
      "Right column of the homepage, above the advertise button. Upload several images for a carousel.",
    wide: false,
    multiple: true,
  },
  {
    id: "sidebar_slot_2",
    label: "Homepage sidebar ad 2",
    where: "Second right-column slot on the homepage, above the advertise button.",
    wide: false,
    multiple: true,
  },
] as const;

export type BannerSection = (typeof BANNER_SECTIONS)[number]["id"];
export type BannerStatus = "Active" | "Inactive";
export type BannerMedia = "image" | "video";

export const SIDEBAR_AD_SLOTS = ["sidebar_slot_1", "sidebar_slot_2"] as const;
export type SidebarAdSlot = (typeof SIDEBAR_AD_SLOTS)[number];

/**
 * Sidebar carousel slots store several image URLs in `image_url` as a JSON
 * array, so one row still describes one slot without a schema change. Older
 * single-URL values keep working.
 */
export function splitImageUrls(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        );
      }
    } catch {
      /* not JSON — treat the value as one URL */
    }
  }
  return [value];
}

export const bannerImageList = (banner: Banner | null | undefined): string[] =>
  banner ? splitImageUrls(banner.imageUrl) : [];

export type Banner = {
  id: string;
  section: BannerSection | string;
  title: string;
  mediaType: BannerMedia;
  imageUrl: string;
  targetUrl: string;
  status: BannerStatus;
  clicks: number;
  /** Who receives the enquiries captured when this ad is clicked. */
  advertiserName: string;
  advertiserEmail: string;
  advertiserWhatsapp: string;
};

export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
export const ACCEPTED_MEDIA_ATTR = ACCEPTED_MEDIA_TYPES.join(",");
export const MEDIA_BUCKET = "banners";

export const BANNERS_SETUP_HINT =
  "The banners table is not in this database yet. Run supabase/banners.sql in the Supabase SQL editor, then reload this page.";

export type BannersStatus = "idle" | "loading" | "ready" | "missing" | "error";

type Snapshot = { banners: Banner[]; status: BannersStatus; error: string | null };

let snapshot: Snapshot = { banners: [], status: "idle", error: null };
let inflight: Promise<Snapshot> | null = null;
const listeners = new Set<(next: Snapshot) => void>();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(next));
}

export function bannersSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeToBanners(listener: (next: Snapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

/** The table has not been created yet (PostgREST reports it as a missing relation). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|could not find the table|schema cache/i.test(error.message ?? "");
}

type Row = {
  id: string;
  section: string;
  title: string | null;
  media_type: string | null;
  image_url: string | null;
  target_url: string | null;
  status: string | null;
  clicks: number | null;
  advertiser_name: string | null;
  advertiser_email: string | null;
  advertiser_whatsapp: string | null;
};

const rowToBanner = (row: Row): Banner => ({
  id: row.id,
  section: row.section,
  title: row.title ?? "",
  mediaType: row.media_type === "video" ? "video" : "image",
  imageUrl: row.image_url ?? "",
  targetUrl: row.target_url ?? "",
  status: row.status === "Active" ? "Active" : "Inactive",
  clicks: Number(row.clicks ?? 0),
  advertiserName: row.advertiser_name ?? "",
  advertiserEmail: row.advertiser_email ?? "",
  advertiserWhatsapp: row.advertiser_whatsapp ?? "",
});

const COLUMNS =
  "id, section, title, media_type, image_url, target_url, status, clicks, advertiser_name, advertiser_email, advertiser_whatsapp";

/** Older databases have not run supabase/ad-leads.sql yet. */
const COLUMNS_BEFORE_AD_LEADS =
  "id, section, title, media_type, image_url, target_url, status, clicks";

const isMissingColumn = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) &&
  (error?.code === "42703" || /column .* does not exist/i.test(error?.message ?? ""));

/** Read every banner row. Safe to call often: concurrent calls share one request. */
export function loadBanners(): Promise<Snapshot> {
  if (inflight) return inflight;

  inflight = (async (): Promise<Snapshot> => {
    const client = supabaseClient();
    if (!client) {
      const next: Snapshot = { banners: [], status: "idle", error: null };
      emit(next);
      return next;
    }

    emit({ ...snapshot, status: snapshot.banners.length ? snapshot.status : "loading" });
    let rows: Row[] = [];
    let error: { code?: string; message?: string } | null = null;

    try {
      const first = await client.from("banners").select(COLUMNS).order("section");
      rows = (first.data ?? []) as unknown as Row[];
      error = first.error;

      // Before supabase/ad-leads.sql the advertiser columns do not exist. Fall
      // back to the original columns so existing banners keep working.
      if (error && isMissingColumn(error)) {
        const fallback = await client
          .from("banners")
          .select(COLUMNS_BEFORE_AD_LEADS)
          .order("section");
        rows = (fallback.data ?? []) as unknown as Row[];
        error = fallback.error;
      }
    } catch (thrown) {
      error = { message: thrown instanceof Error ? thrown.message : String(thrown) };
    }

    if (error) {
      const next: Snapshot = isMissingTable(error)
        ? { banners: [], status: "missing", error: BANNERS_SETUP_HINT }
        : { banners: snapshot.banners, status: "error", error: describeSupabaseError(error) };
      emit(next);
      return next;
    }

    const next: Snapshot = {
      banners: rows.map(rowToBanner),
      status: "ready",
      error: null,
    };
    emit(next);
    return next;
  })();

  void inflight.finally(() => {
    inflight = null;
  });
  return inflight;
}

/** The banner a page should show, or null when the slot is empty or switched off. */
export function activeBanner(section: BannerSection, banners: Banner[] = snapshot.banners) {
  const banner = banners.find((entry) => entry.section === section);
  if (!banner) return null;
  if (banner.status !== "Active") return null;
  if (!banner.imageUrl.trim()) return null;
  return banner;
}

const usableTarget = (value: string) => value.trim();

/** Where a banner click should go — null when the row has no usable link. */
export function bannerHref(banner: Banner): string | null {
  const target = usableTarget(banner.targetUrl);
  if (!target) return null;
  if (/^(https?:|mailto:|tel:)/i.test(target)) return target;
  if (/^\+?[\d\s-]{6,}$/.test(target)) return `tel:${target.replace(/[^\d+]/g, "")}`;
  return `https://${target.replace(/^\/+/, "")}`;
}

/** Ads open in a new tab unless the link is a dial or mail link. */
export const opensInNewTab = (href: string) => /^https?:/i.test(href);

export function useBanners(): Snapshot {
  const [state, setState] = useState<Snapshot>(bannersSnapshot);
  useEffect(() => {
    const unsubscribe = subscribeToBanners(setState);
    void loadBanners();
    return unsubscribe;
  }, []);
  return state;
}

/** The active banner for one slot, kept in sync with the panel. */
export function useActiveBanner(section: BannerSection): Banner | null {
  const { banners } = useBanners();
  return activeBanner(section, banners);
}

/** Count one click. Fire and forget: a failed count must never block the link. */
export async function trackBannerClick(section: string) {
  const client = supabaseClient();
  if (!client) return;
  void client.rpc("track_banner_click", { p_section: section }).then(({ error }) => {
    if (error) return;
    emit({
      ...snapshot,
      banners: snapshot.banners.map((banner) =>
        banner.section === section ? { ...banner, clicks: banner.clicks + 1 } : banner,
      ),
    });
  });
}

export type SaveBannerInput = {
  section: BannerSection;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  status?: BannerStatus;
  mediaType?: BannerMedia;
  advertiserName?: string;
  advertiserEmail?: string;
  advertiserWhatsapp?: string;
};

/** Create or update one slot. Staff session required — the database enforces it. */
export async function saveBanner(
  input: SaveBannerInput,
): Promise<{ ok: boolean; error?: string; banner?: Banner }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  // A write with an expired token is rejected by the database; refresh first.
  await staffSession();

  const row: Record<string, unknown> = {
    section: input.section,
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) row["title"] = input.title;
  if (input.imageUrl !== undefined) row["image_url"] = input.imageUrl;
  if (input.targetUrl !== undefined) row["target_url"] = input.targetUrl;
  if (input.status !== undefined) row["status"] = input.status;
  if (input.mediaType !== undefined) row["media_type"] = input.mediaType;
  // Leave the advertiser columns alone when they are all empty, so a banner can
  // still be edited before supabase/ad-leads.sql has been run.
  const advertiser = {
    advertiser_name: input.advertiserName?.trim() ?? "",
    advertiser_email: input.advertiserEmail?.trim() ?? "",
    advertiser_whatsapp: input.advertiserWhatsapp?.trim() ?? "",
  };
  if (Object.values(advertiser).some(Boolean)) Object.assign(row, advertiser);

  const { data, error } = await client
    .from("banners")
    .upsert(row, { onConflict: "section" })
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: isMissingTable(error)
        ? BANNERS_SETUP_HINT
        : isMissingColumn(error)
          ? "The advertiser columns are not in the banners table yet. Run supabase/ad-leads.sql in the Supabase SQL editor, then save again."
          : `${describeSupabaseError(error)} — sign in with a staff account, then save again.`,
    };
  }

  const banner = data ? rowToBanner(data as Row) : undefined;
  if (banner) {
    const others = snapshot.banners.filter((entry) => entry.section !== banner.section);
    emit({
      banners: [...others, banner].sort((a, b) => a.section.localeCompare(b.section)),
      status: "ready",
      error: null,
    });
  } else {
    void loadBanners();
  }
  return banner ? { ok: true, banner } : { ok: true };
}

const extensionOf = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

/** Human-readable reason a file cannot be uploaded, or null when it can. */
export function mediaProblem(file: File): string | null {
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
    return "Use a JPG, PNG, WebP or MP4 file.";
  }
  if (file.size > MAX_MEDIA_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That file is ${mb} MB. The limit is 2 MB — compress it and try again.`;
  }
  return null;
}

/** Upload one image or MP4 to the public `banners` bucket and return its URL. */
export async function uploadBannerMedia(
  section: BannerSection,
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string; mediaType?: BannerMedia }> {
  const problem = mediaProblem(file);
  if (problem) return { ok: false, error: problem };

  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };

  // The upload has to carry the staff JWT explicitly. supabase-js mirrors the
  // session into the storage client, but that mirroring happens on auth events,
  // so a page that was reloaded (session restored from localStorage) or a token
  // that expired mid-session can send the request without it and the bucket's
  // is_staff() policy then rejects it.
  const token = await staffAccessToken();
  if (!token) {
    return {
      ok: false,
      error: "No staff session is stored in this browser. Sign in again, then upload.",
    };
  }

  // Every upload gets its own path, so nothing is ever overwritten. upsert:true
  // would make Storage read the existing object first, which needs a SELECT
  // policy on storage.objects and fails RLS for staff uploads; a plain INSERT
  // only needs the "banners media staff write" policy from supabase/banners.sql.
  const path = `${section}-${Date.now()}.${extensionOf(file)}`;
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const message = /bucket/i.test(error.message)
      ? "The banners storage bucket does not exist yet. Run supabase/banners.sql, then try again."
      : /row-level security|unauthorized|jwt|permission/i.test(error.message)
        ? `${error.message} — the request reached Supabase but was refused. Check that your user id (not just the email) is in public.staff, then sign out and sign in again.`
        : `${error.message} — sign in with a staff account, then upload again.`;
    return { ok: false, error: message };
  }

  const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    ok: true,
    url: data.publicUrl,
    mediaType: file.type === "video/mp4" ? "video" : "image",
  };
}
