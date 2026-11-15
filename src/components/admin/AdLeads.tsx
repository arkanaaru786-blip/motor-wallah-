import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import {
  AD_LEADS_SETUP_HINT,
  AD_LEAD_STATUSES,
  advertiserEmailHref,
  advertiserWhatsAppHref,
  customerWhatsAppHref,
  loadAdLeads,
  sectionLabel,
  setAdLeadStatus,
  shortAdLeadTime,
  telHref,
  type AdLead,
  type AdLeadStatus,
} from "@/lib/ad-leads";

type Filter = AdLeadStatus | "All";

const CHIP: Record<AdLeadStatus, string> = {
  New: "is-pending",
  Contacted: "is-active",
  Closed: "is-closed",
};

/**
 * Ad Leads — every visitor who clicked an advertisement and left an enquiry.
 *
 * Leads arrive from the public enquiry popup (supabase/ad-leads.sql). The same
 * screen is where the team forwards a lead to the advertiser on WhatsApp when
 * the server has no WhatsApp Cloud API credentials, so a lead never depends on
 * an unconfigured channel.
 */
export function AdLeadsPanel({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const allowed = isSuperAdmin(actor);

  const [leads, setLeads] = useState<AdLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadAdLeads();
    setLeads(result.leads);
    setMissing(result.missing);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: leads.length,
      fresh: leads.filter((lead) => lead.status === "New").length,
      contacted: leads.filter((lead) => lead.status === "Contacted").length,
    }),
    [leads],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter !== "All" && lead.status !== filter) return false;
      if (!needle) return true;
      return [
        lead.name,
        lead.mobile,
        lead.requirement,
        lead.bannerTitle,
        sectionLabel(lead.bannerSection),
        lead.advertiserName,
        lead.advertiserEmail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, filter, query]);

  async function changeStatus(lead: AdLead, status: AdLeadStatus) {
    setUpdating(lead.id);
    setFlash(null);
    const result = await setAdLeadStatus(lead.id, status);
    setUpdating(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update this lead.");
      return;
    }
    setLeads((current) =>
      current.map((entry) => (entry.id === lead.id ? { ...entry, status } : entry)),
    );
    setFlash(`${lead.name}'s enquiry marked ${status.toLowerCase()}.`);
  }

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="ad-leads-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Ad leads</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">
          Ad leads contain customer phone numbers, so only a super admin can read them.
        </p>
      </section>
    );
  }

  return (
    <div className="mw-admin-dash" data-testid="ad-leads-page">
      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <Inbox size={16} />
            </span>
            <span className="mw-admin-kpi-label">Ad enquiries</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.total}</strong>
          <footer>
            <span>{counts.fresh} waiting for a first call</span>
            <span className="mw-admin-kpi-sub">
              Captured from the enquiry form on every advertisement.
            </span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Phone size={16} />
            </span>
            <span className="mw-admin-kpi-label">Contacted</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.contacted}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Follow-up in progress.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldCheck size={16} />
            </span>
            <span className="mw-admin-kpi-label">Delivery</span>
          </header>
          <strong className="mw-admin-kpi-value">Email</strong>
          <footer>
            <span className="mw-admin-kpi-sub">
              WhatsApp sends automatically when the server has Cloud API credentials; otherwise
              forward in one click below.
            </span>
          </footer>
        </article>
      </section>

      {missing ? (
        <p className="mw-admin-error" data-testid="ad-leads-setup">
          {AD_LEADS_SETUP_HINT}
        </p>
      ) : null}
      {error && !missing ? (
        <p className="mw-admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="mw-admin-flash" role="status">
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}

      <section className="mw-admin-panel">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Customer enquiries</p>
            <h2>
              <Inbox size={15} /> Ad Leads
            </h2>
            <p>
              Name, mobile and requirement from every ad click. The advertiser’s email is notified
              automatically; use these buttons to follow up or forward the lead on WhatsApp.
            </p>
          </div>
          <div className="mw-admin-inline">
            <label className="mw-admin-select">
              <span className="sr-only">Filter by status</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                data-testid="ad-leads-filter"
              >
                <option value="All">All statuses</option>
                {AD_LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="mw-admin-ghost"
              onClick={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
              data-testid="ad-leads-refresh"
            >
              {refreshing ? <Loader2 size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </header>

        <div className="mw-admin-formgrid">
          <label className="mw-admin-field">
            <span>Search leads</span>
            <input
              className="mw-admin-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, mobile, requirement or ad"
              data-testid="ad-leads-search"
            />
          </label>
        </div>

        {loading ? (
          <p className="mw-admin-hint" aria-busy="true">
            <Loader2 size={14} /> Loading ad leads…
          </p>
        ) : visible.length === 0 ? (
          <p className="mw-admin-empty" data-testid="ad-leads-empty">
            {leads.length === 0
              ? "No ad enquiries yet. They appear here the moment a visitor submits the form on an advertisement."
              : "No leads match this filter."}
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table mw-adleads-table" data-testid="ad-leads-table">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Requirement</th>
                  <th scope="col">Advertisement</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const advertiserWhatsApp = advertiserWhatsAppHref(lead);
                  const advertiserEmail = advertiserEmailHref(lead);
                  return (
                    <tr key={lead.id} data-testid={`ad-lead-row-${lead.id}`}>
                      <td className="is-muted">{shortAdLeadTime(lead.createdAt)}</td>
                      <td>
                        <strong>{lead.name}</strong>
                        <div className="is-muted">
                          <a href={telHref(lead.mobile)}>{lead.mobile}</a>
                        </div>
                      </td>
                      <td className="mw-adleads-requirement">{lead.requirement || "—"}</td>
                      <td>
                        <strong>{lead.bannerTitle || sectionLabel(lead.bannerSection)}</strong>
                        <div className="is-muted">
                          {lead.advertiserName || "No advertiser set"}
                          {lead.advertiserEmail ? ` · ${lead.advertiserEmail}` : ""}
                        </div>
                      </td>
                      <td>
                        <span className={`mw-dealer-chip ${CHIP[lead.status]}`}>{lead.status}</span>
                        <select
                          className="mw-admin-input mw-adleads-status"
                          value={lead.status}
                          disabled={updating === lead.id}
                          aria-label={`Status for ${lead.name}`}
                          onChange={(event) =>
                            void changeStatus(lead, event.target.value as AdLeadStatus)
                          }
                          data-testid={`ad-lead-status-${lead.id}`}
                        >
                          {AD_LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="mw-dealer-actions">
                          {advertiserWhatsApp ? (
                            <a
                              className="mw-dealer-btn is-small"
                              href={advertiserWhatsApp}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Forward this lead to the advertiser on WhatsApp"
                            >
                              <MessageCircle size={12} /> Advertiser
                            </a>
                          ) : null}
                          {advertiserEmail ? (
                            <a
                              className="mw-dealer-btn is-small"
                              href={advertiserEmail}
                              title="Email the advertiser about this lead"
                            >
                              <Mail size={12} /> Email
                            </a>
                          ) : null}
                          <a
                            className="mw-dealer-btn is-small"
                            href={customerWhatsAppHref(lead)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp the customer"
                          >
                            <MessageCircle size={12} /> Customer
                          </a>
                          <a
                            className="mw-dealer-btn is-small"
                            href={telHref(lead.mobile)}
                            title="Call the customer"
                          >
                            <Phone size={12} /> Call
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          First time here? Run <code>supabase/ad-leads.sql</code> in the Supabase SQL editor — it
          creates the table. Add the advertiser’s email and WhatsApp in Banners &amp; Ads so their
          enquiries are delivered straight to them.
        </p>
      </section>
    </div>
  );
}
