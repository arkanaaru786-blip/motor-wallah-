import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MousePointerClick,
  RefreshCw,
  Save,
  ShieldCheck,
  Video,
} from "lucide-react";
import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import {
  ACCEPTED_MEDIA_ATTR,
  BANNERS_SETUP_HINT,
  BANNER_SECTIONS,
  MAX_MEDIA_BYTES,
  activeBanner,
  bannerHref,
  loadBanners,
  mediaProblem,
  saveBanner,
  uploadBannerMedia,
  useBanners,
  type Banner,
  type BannerSection,
  type BannerStatus,
} from "@/lib/banners";
import { currentStaff, staffSignIn, staffSignOut, type StaffState } from "@/lib/staff-auth";

/**
 * Banners & Ads — the control room screen for every ad slot on the site.
 *
 * One card per slot: artwork (image or MP4), target link, on/off switch and the
 * click count that slot has collected. Uploads land in the public `banners`
 * Storage bucket and the row is written to `banners` in Supabase, so the
 * marketing team never needs a redeploy.
 *
 * Saving and uploading need a staff session: the panel's own login is a local
 * credential check the database knows nothing about, so this screen offers the
 * same Supabase sign-in the Site Settings screen uses.
 */

type Draft = {
  title: string;
  targetUrl: string;
  imageUrl: string;
  mediaType: "image" | "video";
  status: BannerStatus;
};

const draftFrom = (banner: Banner | undefined): Draft => ({
  title: banner?.title ?? "",
  targetUrl: banner?.targetUrl ?? "",
  imageUrl: banner?.imageUrl ?? "",
  mediaType: banner?.mediaType ?? "image",
  status: banner?.status ?? "Inactive",
});

/** Empty is allowed (artwork-only slot); anything else must resolve to a link. */
function targetProblem(value: string): string | null {
  const target = value.trim();
  if (!target) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(target)) return null;
  if (/^\+?\d[\d\s-]{5,}$/.test(target)) return null;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(target)) return null;
  return "That does not look like a link. Use https://…, tel:+91…, or wa.me/…";
}

function SectionCard({
  id,
  label,
  where,
  banner,
  signedIn,
}: {
  id: BannerSection;
  label: string;
  where: string;
  banner: Banner | undefined;
  signedIn: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(banner));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the form in step with the row after a save or a fresh read.
  useEffect(() => {
    setDraft(draftFrom(banner));
  }, [banner?.section, banner?.title, banner?.targetUrl, banner?.imageUrl, banner?.mediaType, banner?.status]);

  const dirty =
    draft.title !== (banner?.title ?? "") ||
    draft.targetUrl !== (banner?.targetUrl ?? "") ||
    draft.imageUrl !== (banner?.imageUrl ?? "") ||
    draft.status !== (banner?.status ?? "Inactive");

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  async function persist(patch: Partial<Draft> = {}) {
    const next = { ...draft, ...patch };
    setError(null);
    setFlash(null);

    const linkProblem = targetProblem(next.targetUrl);
    if (linkProblem) {
      setError(linkProblem);
      return;
    }
    if (next.status === "Active" && !next.imageUrl) {
      setError("Upload the artwork first — an active banner needs an image or a video.");
      return;
    }

    setSaving(true);
    const result = await saveBanner({
      section: id,
      title: next.title.trim(),
      targetUrl: next.targetUrl.trim(),
      imageUrl: next.imageUrl,
      mediaType: next.mediaType,
      status: next.status,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not save this banner.");
      return;
    }
    if (patch.status) setDraft((current) => ({ ...current, status: patch.status! }));
    setFlash(
      patch.status
        ? `Banner ${patch.status === "Active" ? "activated — it is live on the site now" : "deactivated"}.`
        : "Saved. The site picks it up the next time a page loads.",
    );
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setFlash(null);

    const problem = mediaProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    setUploading(true);
    const result = await uploadBannerMedia(id, file);
    setUploading(false);

    if (!result.ok || !result.url) {
      setError(result.error ?? "Could not upload that file.");
      return;
    }
    update({ imageUrl: result.url, mediaType: result.mediaType ?? "image" });
    setFlash("Uploaded. Press Save to publish it.");
  }

  const preview = draft.imageUrl;

  return (
    <section className="mw-admin-panel mw-admin-banner-card" data-testid={`banner-card-${id}`}>
      <header className="mw-admin-panel-head">
        <div>
          <p className="mw-admin-eyebrow">{label}</p>
          <h2>{banner?.title.trim() || "Untitled slot"}</h2>
        </div>
        <span
          className={`mw-admin-chip${draft.status === "Active" ? " is-ok" : ""}`}
          data-testid={`banner-status-${id}`}
        >
          {draft.status}
        </span>
      </header>

      <div className="mw-admin-banner-preview">
        {preview ? (
          draft.mediaType === "video" ? (
            <video src={preview} autoPlay muted loop playsInline />
          ) : (
            <img src={preview} alt="" />
          )
        ) : (
          <span className="mw-admin-banner-empty">
            <ImageIcon size={20} /> No artwork yet — the site shows its built-in design
          </span>
        )}
      </div>

      <p className="mw-admin-hint">
        <MousePointerClick size={13} /> <strong data-testid={`banner-clicks-${id}`}>{banner?.clicks ?? 0}</strong>{" "}
        clicks · {where}
      </p>

      <div className="mw-admin-form">
        <label className="mw-admin-field">
          <span>Caption (optional)</span>
          <input
            className="mw-admin-input"
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder="ABC Auto Care"
            data-testid={`banner-title-${id}`}
          />
        </label>

        <label className="mw-admin-field">
          <span>Target URL</span>
          <input
            className="mw-admin-input"
            value={draft.targetUrl}
            onChange={(event) => update({ targetUrl: event.target.value })}
            placeholder="https://wa.me/919999999999"
            data-testid={`banner-target-${id}`}
          />
          <small className="mw-admin-hint">
            Website, WhatsApp, Instagram or a phone number. Opens in a new tab; every click is
            counted.
          </small>
        </label>

        <label className="mw-admin-field">
          <span>
            {draft.mediaType === "video" ? <Video size={13} /> : <ImageIcon size={13} />} Upload
            JPG, PNG or MP4
          </span>
          <input
            className="mw-admin-input mw-admin-file"
            type="file"
            accept={ACCEPTED_MEDIA_ATTR}
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            data-testid={`banner-file-${id}`}
          />
          <small className="mw-admin-hint">
            Up to {(MAX_MEDIA_BYTES / (1024 * 1024)).toFixed(0)} MB. {uploading ? "Uploading…" : ""}
          </small>
        </label>
      </div>

      {flash ? (
        <p className="mw-admin-flash" data-testid={`banner-flash-${id}`}>
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-admin-error" data-testid={`banner-error-${id}`}>
          {error}
        </p>
      ) : null}

      <div className="mw-admin-inline">
        <button
          type="button"
          className="mw-admin-primary"
          onClick={() => void persist()}
          disabled={!signedIn || saving || uploading || !dirty}
          data-testid={`banner-save-${id}`}
        >
          {saving ? <Loader2 size={15} /> : <Save size={15} />} {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="mw-admin-ghost"
          onClick={() => void persist({ status: draft.status === "Active" ? "Inactive" : "Active" })}
          disabled={!signedIn || saving || uploading}
          data-testid={`banner-toggle-${id}`}
        >
          {draft.status === "Active" ? "Deactivate" : "Activate"}
        </button>
        {draft.targetUrl && bannerHref({ ...draft, section: id } as Banner) ? (
          <a
            className="mw-admin-activity-link"
            href={bannerHref({ ...draft, section: id } as Banner) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={13} /> Test link
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function BannersAdsPanel({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const allowed = isSuperAdmin(actor);

  const { banners, status, error } = useBanners();
  const [staff, setStaff] = useState<StaffState | null>(null);
  const [staffChecked, setStaffChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const state = await currentStaff();
      if (!alive) return;
      setStaff(state);
      setStaffChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSignIn() {
    setAuthError(null);
    setSigningIn(true);
    const result = await staffSignIn(email, password);
    setSigningIn(false);
    if (!result.ok) {
      setAuthError(result.error ?? "Could not sign in.");
      return;
    }
    setPassword("");
    const state = await currentStaff();
    setStaff(state);
    if (!result.isStaff) {
      setAuthError(
        "That account signed in, but it is not on the staff allow-list, so the database will refuse the upload.",
      );
    }
  }

  async function handleSignOut() {
    await staffSignOut();
    setStaff(null);
  }

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="banners-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Banners &amp; ads</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">
          Advertising artwork appears on the public homepage and the BUY page, so only a super admin
          can change it.
        </p>
      </section>
    );
  }

  const signedIn = Boolean(staff?.email);
  const totalClicks = banners.reduce((sum, banner) => sum + banner.clicks, 0);
  const live = banners.filter((banner) => activeBanner(banner.section as BannerSection, [banner]));

  return (
    <div className="mw-admin-banners" data-testid="banners-page">
      {status === "missing" ? (
        <p className="mw-admin-error" data-testid="banners-setup">
          {error ?? BANNERS_SETUP_HINT}
        </p>
      ) : null}
      {status === "error" && error ? <p className="mw-admin-error">{error}</p> : null}

      <div className="mw-admin-banners-head">
        <p className="mw-admin-hint">
          <MousePointerClick size={13} /> <strong>{totalClicks}</strong> clicks across every slot ·{" "}
          <strong>{live.length}</strong> live
        </p>
        <button
          type="button"
          className="mw-admin-ghost"
          onClick={() => {
            setRefreshing(true);
            void loadBanners().finally(() => setRefreshing(false));
          }}
          data-testid="banners-refresh"
        >
          {refreshing ? <Loader2 size={14} /> : <RefreshCw size={14} />} Refresh counts
        </button>
      </div>

      <div className="mw-admin-banners-grid">
        {BANNER_SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            id={section.id}
            label={section.label}
            where={section.where}
            banner={banners.find((entry) => entry.section === section.id)}
            signedIn={signedIn}
          />
        ))}
      </div>

      <section className="mw-admin-panel" aria-labelledby="banners-auth-title">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Database access</p>
            <h2 id="banners-auth-title">
              <ShieldCheck size={16} />{" "}
              {signedIn ? "Staff session active" : "Staff sign-in required"}
            </h2>
          </div>
          {signedIn ? (
            <button
              type="button"
              className="mw-admin-ghost"
              onClick={() => void handleSignOut()}
              data-testid="banners-staff-signout"
            >
              <LogOut size={14} /> Sign out
            </button>
          ) : null}
        </header>

        {!staffChecked ? (
          <p className="mw-admin-hint">Checking for a staff session…</p>
        ) : signedIn ? (
          <p className="mw-admin-hint" data-testid="banners-staff-state">
            Signed in as <strong>{staff?.email}</strong>.{" "}
            {staff?.isStaff
              ? "Uploads and saves are allowed."
              : "This account is not on the staff allow-list, so the database will refuse the write."}
          </p>
        ) : (
          <div className="mw-admin-form" data-testid="banners-signin">
            <p className="mw-admin-hint">
              Uploads go to Supabase Storage and the rows are staff-writable, so sign in with a
              staff account to edit a banner.
            </p>
            <div className="mw-admin-formgrid">
              <label className="mw-admin-field">
                <span>Staff email</span>
                <input
                  className="mw-admin-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  data-testid="banners-staff-email"
                />
              </label>
              <label className="mw-admin-field">
                <span>Password</span>
                <input
                  className="mw-admin-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSignIn();
                  }}
                  data-testid="banners-staff-password"
                />
              </label>
            </div>
            {authError ? <p className="mw-admin-error">{authError}</p> : null}
            <div className="mw-admin-inline">
              <button
                type="button"
                className="mw-admin-primary"
                onClick={() => void handleSignIn()}
                disabled={signingIn || !email.trim() || !password}
                data-testid="banners-staff-submit"
              >
                {signingIn ? <Loader2 size={15} /> : <ShieldCheck size={15} />}
                {signingIn ? "Signing in…" : "Sign in to edit"}
              </button>
            </div>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          First time here? Run <code>supabase/banners.sql</code> in the Supabase SQL editor — it
          creates the table, the click counter and the storage bucket.
        </p>
      </section>
    </div>
  );
}
