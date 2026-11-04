import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import { loadSiteSettings, saveSiteSettings } from "@/lib/site-settings";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL, WHATSAPP_BASE } from "@/lib/site";
import { currentStaff, staffSignIn, staffSignOut, type StaffState } from "@/lib/staff-auth";

/**
 * Site Settings.
 *
 * The support phone number, WhatsApp line and inbox used to be constants in
 * src/lib/site.ts, so changing a number meant a redeploy. They live in the
 * `site_settings` table now and this screen edits them.
 *
 * Two things are worth knowing before reading the code:
 *
 *  - Saving is a database write, not a local one, so it needs a staff session.
 *    The panel's own login is a local credential check, which the database knows
 *    nothing about, so this screen offers a separate Supabase sign-in and says
 *    plainly when nobody is signed in.
 *  - The values are read at start-up by `loadSiteSettings()`, so a change shows
 *    up on the next page load in every tab — not instantly, and never silently.
 */
type Draft = {
  phoneDisplay: string;
  phoneHref: string;
  whatsappBase: string;
  supportEmail: string;
};

const liveValues = (): Draft => ({
  phoneDisplay: PHONE_DISPLAY,
  phoneHref: PHONE_HREF,
  whatsappBase: WHATSAPP_BASE,
  supportEmail: SUPPORT_EMAIL,
});

/** Digits and a leading + only — the number people actually dial. */
const dialable = (value: string) => value.replace(/[^\d+]/g, "");

function problemsWith(draft: Draft): string[] {
  const problems: string[] = [];

  if (draft.phoneDisplay.trim().length < 6) {
    problems.push("Enter the support number as people should read it, for example 1800 123 4567.");
  }
  if (!/^tel:\+?\d[\d\s-]{4,}$/.test(draft.phoneHref.trim())) {
    problems.push(
      'The dial link must start with "tel:" and contain only digits, for example tel:+911800123456.',
    );
  }
  if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)\/\d{8,15}$/.test(draft.whatsappBase.trim())) {
    problems.push(
      "The WhatsApp link must look like https://wa.me/919999999999 — country code first, no plus sign.",
    );
  }
  if (
    draft.supportEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.supportEmail.trim())
  ) {
    problems.push("The support email does not look like an email address.");
  }
  return problems;
}

export function SiteSettingsPanel({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const allowed = isSuperAdmin(actor);

  const [draft, setDraft] = useState<Draft>(() => liveValues());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffState | null>(null);
  const [staffChecked, setStaffChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const remote = await loadSiteSettings();
      if (!alive) return;
      if (remote) setDraft({ ...liveValues(), ...remote });
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const problems = useMemo(() => problemsWith(draft), [draft]);
  const dirty = useMemo(() => {
    const now = liveValues();
    return (Object.keys(now) as (keyof Draft)[]).some((field) => now[field] !== draft[field]);
  }, [draft]);

  const update = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  async function handleSave() {
    setFlash(null);
    setError(null);
    if (problems.length > 0) {
      setError(problems[0]!);
      return;
    }

    setSaving(true);
    const result = await saveSiteSettings({
      phoneDisplay: draft.phoneDisplay.trim(),
      phoneHref: draft.phoneHref.trim(),
      whatsappBase: draft.whatsappBase.trim(),
      supportEmail: draft.supportEmail.trim(),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not save the settings.");
      return;
    }
    setDraft(liveValues());
    setFlash("Saved to Supabase. Every page uses the new values the next time it loads.");
  }

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
        "That account signed in, but it is not on the staff allow-list, so the database will still refuse writes. Add it to the public.staff table (see supabase/README.md), then sign in again.",
      );
    }
  }

  async function handleStaffSignOut() {
    await staffSignOut();
    setStaff(null);
    setAuthError(null);
    setFlash(null);
  }

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="settings-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Site settings</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">
          The support number and inbox appear on every page of the public site, so only a super
          admin can change them. Ask a super admin to make the change for you.
        </p>
      </section>
    );
  }

  const signedIn = Boolean(staff?.email);

  return (
    <div className="mw-admin-settings" data-testid="settings-page">
      {flash ? (
        <p className="mw-admin-flash" data-testid="settings-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-admin-error" data-testid="settings-error">
          {error}
        </p>
      ) : null}

      <div className="mw-admin-bento">
        <section className="mw-admin-panel mw-admin-span-7" aria-labelledby="settings-form-title">
          <header className="mw-admin-panel-head">
            <div>
              <p className="mw-admin-eyebrow">Support details</p>
              <h2 id="settings-form-title">What customers see</h2>
            </div>
            <span className="mw-admin-chip" data-testid="settings-dirty">
              {dirty ? "Unsaved changes" : "In sync"}
            </span>
          </header>

          {!loaded ? (
            <p className="mw-admin-hint">
              <Loader2 size={14} /> Reading the saved values…
            </p>
          ) : null}

          <div className="mw-admin-form">
            <div className="mw-admin-formgrid">
              <label className="mw-admin-field">
                <span>Support phone (as shown)</span>
                <input
                  className="mw-admin-input"
                  value={draft.phoneDisplay}
                  onChange={(event) => update("phoneDisplay", event.target.value)}
                  placeholder="1800 123 4567"
                  inputMode="tel"
                  data-testid="settings-phone-display"
                />
                <small className="mw-admin-hint">
                  Appears in the call buttons and the footer on every page.
                </small>
              </label>

              <label className="mw-admin-field">
                <span>Phone dial link</span>
                <input
                  className="mw-admin-input"
                  value={draft.phoneHref}
                  onChange={(event) => update("phoneHref", event.target.value)}
                  placeholder="tel:+911800123456"
                  data-testid="settings-phone-href"
                />
                <small className="mw-admin-hint">
                  What a tap on mobile number dials. Digits only after “tel:”, country code
                  included.
                </small>
              </label>

              <label className="mw-admin-field">
                <span>WhatsApp link</span>
                <input
                  className="mw-admin-input"
                  value={draft.whatsappBase}
                  onChange={(event) => update("whatsappBase", event.target.value)}
                  placeholder="https://wa.me/919999999999"
                  data-testid="settings-whatsapp"
                />
                <small className="mw-admin-hint">
                  Country code and number, no plus sign. Every “Chat on WhatsApp” button appends its
                  own message to this link.
                </small>
              </label>

              <label className="mw-admin-field">
                <span>Support email</span>
                <input
                  className="mw-admin-input"
                  value={draft.supportEmail}
                  onChange={(event) => update("supportEmail", event.target.value)}
                  placeholder="care@motorwallah.in"
                  inputMode="email"
                  data-testid="settings-email"
                />
                <small className="mw-admin-hint">
                  Shown in the footer and used by every “email us” link. Leave empty to keep the
                  default care@motorwallah.in.
                </small>
              </label>
            </div>

            <div className="mw-admin-inline">
              <button
                type="button"
                className="mw-admin-primary"
                onClick={() => void handleSave()}
                disabled={saving || !signedIn}
                data-testid="settings-save"
              >
                {saving ? <Loader2 size={15} /> : <Save size={15} />}
                {saving ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                className="mw-admin-ghost"
                onClick={() => {
                  setDraft(liveValues());
                  setError(null);
                  setFlash(null);
                }}
                disabled={!dirty || saving}
                data-testid="settings-reset"
              >
                Reset
              </button>
            </div>

            {!signedIn ? (
              <p className="mw-admin-hint" data-testid="settings-save-hint">
                Saving is disabled until a staff account is signed in below — the database only
                accepts this write from a staff member.
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="mw-admin-panel mw-admin-span-5"
          aria-labelledby="settings-preview-title"
        >
          <header className="mw-admin-panel-head">
            <div>
              <p className="mw-admin-eyebrow">Preview</p>
              <h2 id="settings-preview-title">Where these go</h2>
            </div>
          </header>

          <ul className="mw-admin-actionlist" data-testid="settings-preview">
            <li className="mw-admin-actionmain">
              <span className="mw-admin-actiontype">
                <Phone size={14} /> Call buttons &amp; footer
              </span>
              <a className="mw-admin-activity-link" href={draft.phoneHref || "#"}>
                {draft.phoneDisplay || "—"}
              </a>
            </li>
            <li className="mw-admin-actionmain">
              <span className="mw-admin-actiontype">
                <MessageCircle size={14} /> WhatsApp buttons
              </span>
              <span className="mw-admin-audittext">{draft.whatsappBase || "—"}</span>
            </li>
            <li className="mw-admin-actionmain">
              <span className="mw-admin-actiontype">
                <Mail size={14} /> Footer &amp; email links
              </span>
              <a
                className="mw-admin-activity-link"
                href={`mailto:${draft.supportEmail || "care@motorwallah.in"}`}
              >
                {draft.supportEmail || "care@motorwallah.in (default)"}
              </a>
            </li>
          </ul>

          <p className="mw-admin-hint">
            The site reads these values once per page load, so open a page in a new tab after saving
            to see the change. Numbers already open in another tab keep the old value until
            refreshed.
          </p>
        </section>
      </div>

      <section className="mw-admin-panel" aria-labelledby="settings-auth-title">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Database access</p>
            <h2 id="settings-auth-title">
              <ShieldCheck size={16} />{" "}
              {signedIn ? "Staff session active" : "Staff sign-in required"}
            </h2>
          </div>
          {signedIn ? (
            <button
              type="button"
              className="mw-admin-ghost"
              onClick={() => void handleStaffSignOut()}
              data-testid="settings-staff-signout"
            >
              <LogOut size={14} /> Sign out
            </button>
          ) : null}
        </header>

        {!staffChecked ? (
          <p className="mw-admin-hint">Checking for a staff session…</p>
        ) : signedIn ? (
          <div data-testid="settings-staff-state">
            <p className="mw-admin-hint">
              Signed in as <strong data-testid="settings-staff-email">{staff?.email}</strong>.{" "}
              {staff?.isStaff
                ? "This account is on the staff allow-list, so saving is allowed."
                : "This account is not on the staff allow-list, so the database will refuse the save."}
            </p>
            <p className="mw-admin-hint">
              This staff session is kept separately from the visitor session that owns the carts and
              chats, so signing in here never moves a customer's data.
            </p>
          </div>
        ) : (
          <div className="mw-admin-form" data-testid="settings-signin">
            <p className="mw-admin-hint">
              Sign in with the email and password of a Supabase user you listed in{" "}
              <code>public.staff</code>. Visitors never see this form — it only appears inside the
              control room.
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
                  data-testid="settings-staff-email-input"
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
                  data-testid="settings-staff-password"
                />
              </label>
            </div>
            {authError ? (
              <p className="mw-admin-error" data-testid="settings-auth-error">
                {authError}
              </p>
            ) : null}
            <div className="mw-admin-inline">
              <button
                type="button"
                className="mw-admin-primary"
                onClick={() => void handleSignIn()}
                disabled={signingIn || !email.trim() || !password}
                data-testid="settings-staff-submit"
              >
                {signingIn ? <Loader2 size={15} /> : <ShieldCheck size={15} />}
                {signingIn ? "Signing in…" : "Sign in to save"}
              </button>
            </div>
          </div>
        )}

        {signedIn ? null : (
          <p className="mw-admin-setup-hint" data-testid="settings-setup-hint">
            No staff user yet? Supabase dashboard → Authentication → Users → Add user, then add that
            user's id to <code>public.staff</code>. supabase/README.md has the exact statement.
          </p>
        )}
      </section>
    </div>
  );
}
