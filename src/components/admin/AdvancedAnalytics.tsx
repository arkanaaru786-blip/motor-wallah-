import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bug, ShieldAlert, Target, TrendingDown, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminSession } from "@/lib/admin-auth";
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from "@/lib/analytics";
import { formatPrice } from "@/lib/cars-data";

export function AdvancedAnalytics({ session }: { session: AdminSession }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [tab, setTab] = useState<"overview" | "spam">("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadAnalyticsSnapshot()
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const highestDropOff = useMemo(() => {
    if (!snapshot) return null;
    let idx = 1;
    for (let i = 2; i < snapshot.funnel.length; i++) {
      if (snapshot.funnel[i]!.dropOffRate > snapshot.funnel[idx]!.dropOffRate) idx = i;
    }
    return snapshot.funnel[idx] ?? null;
  }, [snapshot]);

  return (
    <AdminShell
      session={session}
      title="Advanced Analytics"
      subtitle="GA4 + Supabase tracking, funnel insights, bot detection and privacy-aware reporting"
      actions={
        <span className="mw-admin-topbartag">
          <Activity size={13} /> Live tracking
        </span>
      }
    >
      <div className="mw-adv-analytics">
        <section className="mw-adv-hero">
          <div>
            <p className="mw-adv-kicker">Phase 3A • Tracking & Intelligence</p>
            <h2 className="mw-adv-title">Powerful funnel, traffic & lead-quality analytics</h2>
            <p className="mw-adv-sub">
              Tracks page views, custom events, visitor sessions and flags suspicious submissions
              in under 3 seconds or without reCAPTCHA.
            </p>
          </div>
          <div className="mw-adv-pill">
            <ShieldAlert size={14} /> {snapshot?.suspiciousLeads ?? 0} suspicious leads flagged
          </div>
        </section>

        <section className="mw-adv-kpi-grid">
          <article className="mw-adv-kpi">
            <p className="mw-adv-kpi-label">
              <Users size={14} /> Total Visits
            </p>
            <p className="mw-adv-kpi-value">{snapshot?.totalVisits.toLocaleString("en-IN") ?? "—"}</p>
            <p className="mw-adv-kpi-meta">Visitor sessions captured across the site</p>
          </article>
          <article className="mw-adv-kpi">
            <p className="mw-adv-kpi-label">
              <Target size={14} /> Total Leads
            </p>
            <p className="mw-adv-kpi-value">{snapshot?.totalLeads.toLocaleString("en-IN") ?? "—"}</p>
            <p className="mw-adv-kpi-meta">All lead types from public forms</p>
          </article>
          <article className="mw-adv-kpi">
            <p className="mw-adv-kpi-label">
              <BarChart3 size={14} /> Conversion Rate
            </p>
            <p className="mw-adv-kpi-value">{snapshot ? `${snapshot.conversionRate}%` : "—"}</p>
            <p className="mw-adv-kpi-meta">Leads / Total Visits</p>
          </article>
          <article className="mw-adv-kpi">
            <p className="mw-adv-kpi-label">
              <TrendingDown size={14} /> Bounce Rate
            </p>
            <p className="mw-adv-kpi-value">{snapshot ? `${snapshot.bounceRate}%` : "—"}</p>
            <p className="mw-adv-kpi-meta">Sessions with a single page view</p>
          </article>
        </section>

        <div className="mw-adv-tabs">
          <button
            type="button"
            className={`mw-adv-tab ${tab === "overview" ? "is-active" : ""}`}
            onClick={() => setTab("overview")}
          >
            <BarChart3 size={14} /> Overview
          </button>
          <button
            type="button"
            className={`mw-adv-tab ${tab === "spam" ? "is-active" : ""}`}
            onClick={() => setTab("spam")}
          >
            <Bug size={14} /> Spam/Bots ({snapshot?.spamLeads.length ?? 0})
          </button>
        </div>

        {tab === "overview" ? (
          <>
            <section className="mw-adv-grid">
              <article className="mw-adv-panel">
                <header className="mw-adv-panel-header">
                  <div>
                    <p className="mw-adv-panel-title">Funnel & Drop-off Chart</p>
                    <p className="mw-adv-panel-sub">
                      Total Visits → Category Views → Vehicle Views → Form Submits → Orders
                    </p>
                  </div>
                  {highestDropOff ? (
                    <div className="mw-adv-pill">
                      Highest drop-off: {highestDropOff.label} ({highestDropOff.dropOffRate}%)
                    </div>
                  ) : null}
                </header>
                <div className="mw-adv-funnel">
                  {(snapshot?.funnel ?? []).map((step) => {
                    const width = snapshot ? Math.max(12, (step.count / snapshot.funnel[0]!.count) * 100) : 12;
                    return (
                      <div key={step.key} className="mw-adv-funnel-row" style={{ ["--w" as any]: `${width}%` }}>
                        <div className="mw-adv-funnel-label">
                          <span className="mw-adv-funnel-dot" />
                          <span>{step.label}</span>
                        </div>
                        <div className="mw-adv-funnel-meta">
                          <span>{step.count.toLocaleString("en-IN")}</span>
                          {step.key !== "visits" ? <span>−{step.dropOffRate}% drop-off</span> : <span>Entry point</span>}
                        </div>
                      </div>
                    );
                  })}
                  {loading && !snapshot ? <p className="mw-adv-empty">Loading funnel data…</p> : null}
                </div>
              </article>
              <article className="mw-adv-panel">
                <header className="mw-adv-panel-header">
                  <div>
                    <p className="mw-adv-panel-title">Traffic Sources</p>
                    <p className="mw-adv-panel-sub">Instagram, Google, Direct and referrals</p>
                  </div>
                </header>
                <div className="mw-adv-table-wrap">
                  <table className="mw-adv-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Visits</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(snapshot?.trafficSources ?? []).map((row) => (
                        <tr key={row.source}>
                          <td>{row.source}</td>
                          <td>{row.visits.toLocaleString("en-IN")}</td>
                          <td>{row.share}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {loading && !snapshot ? <p className="mw-adv-empty">Loading traffic sources…</p> : null}
              </article>
            </section>

            <article className="mw-adv-panel">
              <header className="mw-adv-panel-header">
                <div>
                  <p className="mw-adv-panel-title">Top Viewed Vehicles</p>
                  <p className="mw-adv-panel-sub">Vehicle Name, Views, Leads, Conversion</p>
                </div>
              </header>
              <div className="mw-adv-table-wrap">
                <table className="mw-adv-table">
                  <thead>
                    <tr>
                      <th>Vehicle Name</th>
                      <th>Views</th>
                      <th>Leads</th>
                      <th>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(snapshot?.topVehicles ?? []).map((row) => (
                      <tr key={row.vehicleName}>
                        <td>{row.vehicleName}</td>
                        <td>{row.views.toLocaleString("en-IN")}</td>
                        <td>{row.leads.toLocaleString("en-IN")}</td>
                        <td>
                          <span className="mw-adv-pill">{row.conversion}%</span>
                        </td>
                      </tr>
                    ))}
                    {(snapshot?.topVehicles ?? []).length === 0 && !loading ? (
                      <tr>
                        <td colSpan={4} className="mw-adv-empty">
                          No vehicle view/lead data captured yet. Traffic and events will appear here as visitors browse.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        ) : (
          <article className="mw-adv-panel">
            <header className="mw-adv-panel-header">
              <div>
                <p className="mw-adv-panel-title">Spam/Bots</p>
                <p className="mw-adv-panel-sub">
                  Forms submitted in &lt; 3 seconds or missing reCAPTCHA are marked Suspicious and listed here separately.
                </p>
              </div>
              <div className="mw-adv-pill">
                <Bug size={14} /> {snapshot?.spamLeads.length ?? 0} flagged
              </div>
            </header>
            <div className="mw-adv-table-wrap">
              <table className="mw-adv-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Vehicle</th>
                    <th>Name / Mobile</th>
                    <th>Suspicion</th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshot?.spamLeads ?? []).map((lead, index) => (
                    <tr key={`${lead.createdAt}-${index}`}>
                      <td>{new Date(lead.createdAt).toLocaleString("en-IN")}</td>
                      <td>{lead.type}</td>
                      <td>{lead.source}</td>
                      <td>{lead.vehicleName || "—"}</td>
                      <td>{(lead.name || "—") + " / " + (lead.mobile || "—")}</td>
                      <td>
                        <span className="mw-adv-pill">
                          {lead.fields?.suspicionReason || "Flagged as suspicious"}
                          {lead.fields?.submitDurationMs ? ` • ${Math.round(Number(lead.fields.submitDurationMs) / 100) / 10}s` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(snapshot?.spamLeads ?? []).length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="mw-adv-empty">
                        No suspicious submissions yet. The filter is active on all public forms.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </AdminShell>
  );
}
