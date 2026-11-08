import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";
import {
  DEALER_CATEGORIES,
  dealerCategoryLabel,
  type DealerCategoryId,
} from "@/lib/dealer-categories";
import {
  createDealer,
  ensureDealers,
  listDealers,
  nextDealerId,
  setDealerPassword,
  setDealerStatus,
  subscribeToDealers,
  type Dealer,
  type DealerStatus,
} from "@/lib/dealers";
import { shortDate } from "@/lib/dealer-format";
import {
  createPartner,
  ensurePartners,
  getPartnerType,
  listPartners,
  nextPartnerId,
  partnerCredentialMessage,
  partnerWhatsAppLink,
  setPartnerPassword,
  setPartnerStatus,
  subscribeToPartners,
  PARTNER_TYPES,
  type Partner,
  type PartnerType,
} from "@/lib/partners";

type AccountType = "dealer" | PartnerType;

type AccountRow = {
  key: string;
  kind: "dealer" | "partner";
  type: AccountType;
  id: string;
  business: string;
  name: string;
  mobile: string;
  email: string;
  city: string;
  detail: string;
  contact: string;
  status: DealerStatus;
  lastLoginAt: string | null;
  loginPath: string;
};

type IssuedCredential = {
  key: string;
  kind: "dealer" | "partner";
  type: AccountType;
  id: string;
  business: string;
  mobile: string;
  email: string;
  password: string;
  loginPath: string;
};

const TYPE_LABEL: Record<AccountType, string> = {
  dealer: "Dealer",
  workshop: "Workshop",
  parts: "Auto Parts",
  decor: "Decor",
};

const TYPE_OPTIONS: { id: AccountType; label: string }[] = [
  { id: "dealer", label: "Dealer (vehicle sales)" },
  ...PARTNER_TYPES.map((type) => ({ id: type.id as AccountType, label: type.label })),
];

const CHIP: Record<DealerStatus, string> = {
  Active: "is-active",
  Pending: "is-pending",
  Disabled: "is-rejected",
};

const EMPTY_FORM = {
  type: "dealer" as AccountType,
  name: "",
  business: "",
  email: "",
  mobile: "",
  city: "",
  category: "cars" as DealerCategoryId,
  password: "",
};

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/**
 * Admin control over every partner account — dealers plus the workshop, auto
 * parts and decor portals.
 *
 * The type dropdown is the only place the account type is chosen, and it
 * decides which registry receives the account and which ID prefix the system
 * generates: DLR- for a dealer, MW-WRK-, MW-PRT- and MW-DCR- for the rest.
 * Plaintext passwords are never stored, so the WhatsApp share is offered for
 * the password just created or reset in this session, not for old accounts.
 */
export function PartnerDirectory({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const mayManage = can(actor, "employee.manage");

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState<AccountType | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCredential[]>([]);
  const [resetFor, setResetFor] = useState<AccountRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    void ensureDealers().then(() => setDealers(listDealers()));
    void ensurePartners().then(() => setPartners(listPartners()));
    const offDealers = subscribeToDealers(() => setDealers(listDealers()));
    const offPartners = subscribeToPartners(() => setPartners(listPartners()));
    return () => {
      offDealers();
      offPartners();
    };
  }, []);

  const rows = useMemo<AccountRow[]>(() => {
    const dealerRows: AccountRow[] = dealers.map((dealer) => ({
      key: `dealer:${dealer.id}`,
      kind: "dealer",
      type: "dealer",
      id: dealer.id,
      business: dealer.showroom,
      name: dealer.name,
      mobile: dealer.mobile,
      email: dealer.email,
      city: dealer.city,
      detail: `${dealerCategoryLabel(dealer.category)} dealer`,
      contact: dealer.email,
      status: dealer.status,
      lastLoginAt: dealer.lastLoginAt,
      loginPath: "/dealer-login",
    }));

    const partnerRows: AccountRow[] = partners.map((partner) => ({
      key: `partner:${partner.id}`,
      kind: "partner",
      type: partner.type,
      id: partner.id,
      business: partner.business,
      name: partner.name,
      mobile: partner.mobile,
      email: partner.email,
      city: partner.city,
      detail: `${getPartnerType(partner.type).label} partner`,
      contact: partner.email || partner.mobile,
      status: partner.status,
      lastLoginAt: partner.lastLoginAt,
      loginPath: getPartnerType(partner.type).loginPath,
    }));

    return [...dealerRows, ...partnerRows].sort(
      (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
    );
  }, [dealers, partners]);

  const visible = rows.filter((row) => filter === "all" || row.type === filter);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.status === "Active").length,
      dealers: rows.filter((row) => row.kind === "dealer").length,
      partners: rows.filter((row) => row.kind === "partner").length,
    }),
    [rows],
  );

  const nextId = useMemo(() => {
    const type = form.type;
    if (type === "dealer") return nextDealerId(dealers);
    return nextPartnerId(type, partners);
  }, [form.type, dealers, partners]);

  const credentialFor = (row: AccountRow) => issued.find((item) => item.key === row.key) ?? null;

  const messageFor = (credential: IssuedCredential): string => {
    if (credential.kind === "dealer") {
      return [
        `Hi ${credential.business},`,
        "",
        "Your Motor Wallah Dealer Portal login is ready.",
        `Dealer ID: ${credential.id}`,
        `Login email: ${credential.email}`,
        `Password: ${credential.password}`,
        `Sign in: ${origin()}${credential.loginPath}`,
        "",
        "Keep this password private; ask Motor Wallah staff if you need it changed.",
      ].join("\n");
    }
    return partnerCredentialMessage(
      { id: credential.id, type: credential.type as PartnerType, business: credential.business },
      credential.password,
    );
  };

  const shareLink = (credential: IssuedCredential) =>
    partnerWhatsAppLink(credential.mobile, messageFor(credential));

  const copyCredential = async (credential: IssuedCredential) => {
    try {
      await navigator.clipboard.writeText(messageFor(credential));
      setFlash(`Credentials for ${credential.id} copied.`);
      setError(null);
    } catch {
      setError("This browser blocked the clipboard. Use the WhatsApp share instead.");
    }
  };

  return (
    <div className="mw-admin-dash">
      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <Building2 size={16} />
            </span>
            <span className="mw-admin-kpi-label">Partner accounts</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.total}</strong>
          <footer>
            <span>{counts.active} active</span>
            <span className="mw-admin-kpi-sub">Dealers, workshops, parts and decor.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Store size={16} />
            </span>
            <span className="mw-admin-kpi-label">Dealers</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.dealers}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Existing vehicle dealer portal, unchanged.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldCheck size={16} />
            </span>
            <span className="mw-admin-kpi-label">Service partners</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.partners}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Workshop, auto parts and decor accounts.</span>
          </footer>
        </article>
      </section>

      {flash ? (
        <p className="mw-admin-flash" role="status" data-testid="partner-admin-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-admin-error" role="alert" data-testid="partner-admin-error">
          {error}
        </p>
      ) : null}

      {issued.length > 0 ? (
        <section className="mw-admin-panel">
          <div className="mw-admin-panel-head">
            <div>
              <h2>
                <MessageCircle size={15} /> Credentials ready to share
              </h2>
              <p>
                Passwords are never stored in plaintext, so this is the only moment they can be
                shared. Send them on WhatsApp now, or reset the password later.
              </p>
            </div>
          </div>
          <ul className="mw-partner-issued">
            {issued.map((credential) => (
              <li key={credential.key} data-testid={`partner-issued-${credential.id}`}>
                <div>
                  <strong className="mw-partner-id">{credential.id}</strong>
                  <span>
                    {TYPE_LABEL[credential.type]} · {credential.business}
                  </span>
                </div>
                <code>{credential.password}</code>
                <div className="mw-dealer-actions">
                  <button
                    type="button"
                    className="mw-dealer-btn is-small"
                    onClick={() => void copyCredential(credential)}
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <a
                    className="mw-dealer-btn is-small is-primary"
                    href={shareLink(credential)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resetFor ? (
        <section className="mw-admin-panel">
          <div className="mw-admin-panel-head">
            <div>
              <h2>
                <RefreshCw size={15} /> Set a new password for {resetFor.business}
              </h2>
              <p>
                {resetFor.id} · the new password replaces the old one immediately. Share it on
                WhatsApp after saving.
              </p>
            </div>
          </div>
          <form
            className="mw-dealer-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setBusy(true);
              const result =
                resetFor.kind === "dealer"
                  ? await setDealerPassword(resetFor.id, resetPassword)
                  : await setPartnerPassword(resetFor.id, resetPassword);
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setIssued((items) => [
                {
                  key: resetFor.key,
                  kind: resetFor.kind,
                  type: resetFor.type,
                  id: resetFor.id,
                  business: resetFor.business,
                  mobile: resetFor.mobile,
                  email: resetFor.email,
                  password: resetPassword,
                  loginPath: resetFor.loginPath,
                },
                ...items.filter((item) => item.key !== resetFor.key),
              ]);
              setFlash(`New password set for ${resetFor.id}. Share it with the partner now.`);
              setResetFor(null);
              setResetPassword("");
            }}
          >
            <label className="mw-dealer-field is-span-3">
              <span>New temporary password</span>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="At least 10 characters, letters and numbers"
                required
                autoFocus
              />
            </label>
            <div className="mw-dealer-form-actions">
              <button type="submit" className="mw-dealer-btn is-primary" disabled={busy}>
                <RefreshCw size={14} /> {busy ? "Saving…" : "Save new password"}
              </button>
              <button
                type="button"
                className="mw-dealer-btn is-quiet"
                onClick={() => {
                  setResetFor(null);
                  setResetPassword("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {mayManage ? (
        <section className="mw-admin-panel">
          <div className="mw-admin-panel-head">
            <div>
              <h2>
                <PlusCircle size={15} /> Create a partner
              </h2>
              <p>
                Choose the type first. Dealers keep their email login; workshop, parts and decor
                partners sign in with the auto-generated ID shown below.
              </p>
            </div>
          </div>

          <form
            className="mw-dealer-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setFlash(null);
              setBusy(true);

              if (form.type === "dealer") {
                const result = await createDealer({
                  name: form.name,
                  showroom: form.business,
                  email: form.email,
                  mobile: form.mobile,
                  city: form.city,
                  category: form.category,
                  status: "Active",
                  password: form.password,
                });
                setBusy(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const dealer = result.dealer;
                setIssued((items) => [
                  {
                    key: `dealer:${dealer.id}`,
                    kind: "dealer",
                    type: "dealer",
                    id: dealer.id,
                    business: dealer.showroom,
                    mobile: dealer.mobile,
                    email: dealer.email,
                    password: form.password,
                    loginPath: "/dealer-login",
                  },
                  ...items.filter((item) => item.key !== `dealer:${dealer.id}`),
                ]);
                setFlash(
                  `${dealer.showroom} created as ${dealer.id} — ${dealerCategoryLabel(dealer.category)} only. Share the credentials on WhatsApp.`,
                );
              } else {
                const partnerType = form.type;
                const result = await createPartner({
                  type: partnerType,
                  name: form.name,
                  business: form.business,
                  email: form.email,
                  mobile: form.mobile,
                  city: form.city,
                  status: "Active",
                  password: form.password,
                });
                setBusy(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                const partner = result.partner;
                setIssued((items) => [
                  {
                    key: `partner:${partner.id}`,
                    kind: "partner",
                    type: partner.type,
                    id: partner.id,
                    business: partner.business,
                    mobile: partner.mobile,
                    email: partner.email,
                    password: form.password,
                    loginPath: getPartnerType(partner.type).loginPath,
                  },
                  ...items.filter((item) => item.key !== `partner:${partner.id}`),
                ]);
                setFlash(
                  `${partner.business} created as ${partner.id} — ${getPartnerType(partner.type).label} portal. Share the credentials on WhatsApp.`,
                );
              }

              setDealers(listDealers());
              setPartners(listPartners());
              setForm({ ...EMPTY_FORM, type: form.type });
            }}
            data-testid="partner-create-form"
          >
            <label className="mw-dealer-field">
              <span>Partner type</span>
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
                data-testid="partner-create-type"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mw-dealer-field">
              <span>Generated ID</span>
              <input
                value={nextId}
                readOnly
                aria-label="Generated partner ID"
                className="mw-partner-id-input"
              />
              <span className="mw-dealer-field-hint">
                Auto-generated from the partner type — cannot be edited.
              </span>
            </label>

            {form.type === "dealer" ? (
              <label className="mw-dealer-field">
                <span>Vehicle category (locked to this dealer)</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value as DealerCategoryId })
                  }
                  data-testid="partner-create-category"
                >
                  {DEALER_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="mw-dealer-field">
                <span>Portal</span>
                <input
                  value={`${getPartnerType(form.type).label} · ${getPartnerType(form.type).loginPath}`}
                  readOnly
                  aria-label="Partner portal"
                />
              </label>
            )}

            <label className="mw-dealer-field">
              <span>Contact name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Imran Shaikh"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Business name</span>
              <input
                value={form.business}
                onChange={(event) => setForm({ ...form, business: event.target.value })}
                placeholder={form.type === "workshop" ? "Skyline Service Hub" : "Skyline Motors"}
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Mobile (WhatsApp)</span>
              <input
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                placeholder="9820011201"
                inputMode="tel"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>{form.type === "dealer" ? "Login email" : "Email (optional)"}</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="partner@business.in"
                required={form.type === "dealer"}
              />
            </label>
            <label className="mw-dealer-field">
              <span>City</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="Mumbai"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Temporary password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="At least 10 characters"
                required
              />
            </label>
            <div className="mw-dealer-form-actions">
              <button type="submit" className="mw-dealer-btn is-primary" disabled={busy}>
                <PlusCircle size={15} /> {busy ? "Creating…" : "Create partner"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="mw-admin-flash" role="status">
          <ShieldCheck size={14} /> Your role can view partners but not create or change them.
        </p>
      )}

      <section className="mw-admin-panel">
        <div className="mw-admin-panel-head">
          <div>
            <h2>
              <Building2 size={15} /> Partner accounts
            </h2>
            <p>
              Approve, disable or reset a login. WhatsApp sharing appears for credentials issued in
              this session.
            </p>
          </div>
          <label className="mw-admin-select">
            <span className="sr-only">Filter by partner type</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as AccountType | "all")}
              data-testid="partner-filter-type"
            >
              <option value="all">All partner types</option>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="mw-admin-empty">No partners of this type yet.</p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="partner-admin-table">
              <thead>
                <tr>
                  <th scope="col">Partner</th>
                  <th scope="col">Type</th>
                  <th scope="col">Portal ID</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last login</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const credential = credentialFor(row);
                  return (
                    <tr key={row.key} data-testid={`partner-admin-row-${row.id}`}>
                      <td>
                        <strong>{row.business}</strong>
                        <div className="is-muted">
                          {row.name} · {row.city}
                        </div>
                      </td>
                      <td>
                        <span className="mw-dealer-chip is-closed">{TYPE_LABEL[row.type]}</span>
                        <div className="is-muted">{row.detail}</div>
                      </td>
                      <td>
                        <strong className="mw-partner-id">{row.id}</strong>
                        <div className="is-muted">{row.loginPath}</div>
                      </td>
                      <td>
                        <div className="is-muted">{row.contact}</div>
                        <div className="is-muted">{row.mobile}</div>
                      </td>
                      <td>
                        <span className={`mw-dealer-chip ${CHIP[row.status]}`}>{row.status}</span>
                      </td>
                      <td className="is-muted">
                        {row.lastLoginAt ? shortDate(row.lastLoginAt) : "Never"}
                      </td>
                      <td>
                        <div className="mw-dealer-actions">
                          {credential ? (
                            <a
                              className="mw-dealer-btn is-small"
                              href={shareLink(credential)}
                              target="_blank"
                              rel="noreferrer"
                              data-testid={`partner-share-${row.id}`}
                            >
                              <MessageCircle size={12} /> Share
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              disabled={!mayManage}
                              title="Set a new password to share fresh credentials"
                              onClick={() => {
                                setResetFor(row);
                                setResetPassword("");
                                setError(null);
                              }}
                            >
                              <MessageCircle size={12} /> Reset &amp; share
                            </button>
                          )}

                          {row.status !== "Active" ? (
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              disabled={!mayManage}
                              onClick={() => {
                                if (row.kind === "dealer") setDealerStatus(row.id, "Active");
                                else setPartnerStatus(row.id, "Active");
                                setFlash(`${row.business} approved.`);
                              }}
                            >
                              <BadgeCheck size={13} /> Approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-danger"
                              disabled={!mayManage}
                              onClick={() => {
                                if (row.kind === "dealer") setDealerStatus(row.id, "Disabled");
                                else setPartnerStatus(row.id, "Disabled");
                                setFlash(
                                  `${row.business} disabled — their session ends on next load.`,
                                );
                              }}
                            >
                              <Ban size={13} /> Disable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
