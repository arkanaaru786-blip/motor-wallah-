import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Bug,
  Flame,
  Gauge,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Target,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { LiveVisitorMap } from "@/components/admin/LiveVisitorMap";
import type { AdminSession } from "@/lib/admin-auth";
import { loadAnalyticsSnapshot, type AnalyticsSnapshot } from "@/lib/analytics";
import { buildForecast, type Forecast } from "@/lib/forecasting";
import { loadLeadScores, type LeadScoreSummary, type ScoredLead } from "@/lib/lead-scoring";

const BAND_ICON = {
  Hot: Flame,
  Warm: Thermometer,
  Cold: Snowflake,
} as const;

function bandClass(band: ScoredLead["band"]) {
  return band === "Hot" ? "is-hot" : band === "Warm" ? "is-warm" : "is-cold";
}

function activityLabel(lead: ScoredLead) {
  const minutes = Math.max(1, Math.round(lead.timeOnSiteSeconds / 60));
  return `${lead.pagesVisited} page${lead.pagesVisited === 1 ? "" : "s"} · ${minutes} min`;
}

function intentLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdvancedAnalytics({ session }: { session: AdminSession }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [scores, setScores] = useState<LeadScoreSummary | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [tab, setTab] = useState<"overview" | "spam">("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([loadAnalyticsSnapshot(), loadLeadScores()])
      .then(([data, scoreData]) => {
        if (!active) return;
        setSnapshot(data);
        setScores(scoreData);
        setForecast(
          buildForecast({
            leads: scoreData.scored.map((item) => item.lead),
            snapshot: data,
          }),
        );
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

  const forecastPeak = Math.max(1, ...(forecast?.days.map((day) => day.leads) ?? [1]));
  const topScored = scores?.scored.slice(0, 8) ?? [];

  return (
    <AdminShell
      session={session}
      title="Advanced Analytics"
      subtitle="GA4 + Supabase tracking, AI lead scoring, forecasting, live visitors and bot detection"
      actions={
        <span className="mw-admin-topbartag">
          <Activity size={13} /> Live tracking
        </span>
      }
    >
      <div className="mw-adv-analytics">
        <section className="mw-adv-hero">
          <div>
            <p className="mw-adv-kicker">Phase 3B • Predictive intelligence</p>
            <h2 className="mw-adv-title">Smarter funnel, demand and lead-quality analytics</h2>
            <p className="mw-adv-sub">
              Scores every lead, forecasts next week from your own traffic and flags suspicious
              submissions — all mock models running on our own data, no paid AI APIs.
            </p>
          </div>
          <div className="mw-adv-hero-pills">
            <div className="mw-adv-pill">
              <ShieldAlert size={14} /> {snapshot?.suspiciousLeads ?? 0} suspicious leads
            </div>
            <div className="mw-adv-pill">
              <Gauge size={14} /> Avg lead score {scores?.average ?? 0}
            </div>
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
            {/* ---------------------------------------------------- forecast */}
            <section className="mw-adv-panel mw-adv-forecast" aria-labelledby="forecast-title">
              <header className="mw-adv-panel-header">
                <div>
                  <p className="mw-adv-panel-title" id="forecast-title">
                    <Sparkles size={16} /> Next Week Forecast
                  </p>
                  <p className="mw-adv-panel-sub">
                    {forecast?.basis ??
                      "Modelled from your own lead volume, category demand and weekend traffic."}
                  </p>
                </div>
                <div className="mw-adv-pill">
                  <BrainCircuit size={14} /> {forecast?.confidence ?? 0}% confidence
                </div>
              </header>

              <div className="mw-adv-forecast-grid">
                <article className="mw-adv-forecast-card is-primary">
                  <p>Expected Finance Leads</p>
                  <strong>{forecast ? forecast.expectedFinanceLeads : "—"}</strong>
                  <small>Next 7 days</small>
                </article>
                <article className="mw-adv-forecast-card">
                  <p>Total leads predicted</p>
                  <strong>{forecast ? forecast.expectedLeads : "—"}</strong>
                  <small
                    className={
                      (forecast?.growthPct ?? 0) >= 0 ? "is-up" : "is-down"
                    }
                  >
                    <TrendingUp size={12} /> {forecast?.growthPct ?? 0}% vs last week
                  </small>
                </article>
                <article className="mw-adv-forecast-card">
                  <p>Demand signal</p>
                  <strong className="is-text">{forecast?.demandCallout ?? "—"}</strong>
                  <small>{forecast ? `${forecast.topCategory.share}% of enquiries` : ""}</small>
                </article>
                <article className="mw-adv-forecast-card">
                  <p>Best day to publish</p>
                  <strong className="is-text">
                    {forecast ? `${forecast.bestDay.label} · ${forecast.bestDay.leads} leads` : "—"}
                  </strong>
                  <small>Weekend lift applied</small>
                </article>
              </div>

              <div className="mw-adv-forecast-chart" aria-label="Expected leads per day next week">
                {(forecast?.days ?? []).map((day) => (
                  <div key={day.date} className="mw-adv-forecast-day">
                    <div className="mw-adv-forecast-bar-track">
                      <span
                        className="mw-adv-forecast-bar"
                        style={{ height: `${Math.max(8, (day.leads / forecastPeak) * 100)}%` }}
                        title={`${day.label}: ${day.leads} leads`}
                      />
                    </div>
                    <span className="mw-adv-forecast-daylabel">{day.label}</span>
                    <b>{day.leads}</b>
                  </div>
                ))}
                {loading && !forecast ? (
                  <p className="mw-adv-empty">Building the forecast…</p>
                ) : null}
              </div>

              {forecast ? <p className="mw-adv-forecast-note">{forecast.note}</p> : null}
            </section>

            {/* -------------------------------------------------- live map */}
            <LiveVisitorMap />

            {/* ------------------------------------------- AI lead scoring */}
            <section className="mw-adv-panel" aria-labelledby="lead-scoring-title">
              <header className="mw-adv-panel-header">
                <div>
                  <p className="mw-adv-panel-title" id="lead-scoring-title">
                    <BrainCircuit size={16} /> AI lead scoring
                  </p>
                  <p className="mw-adv-panel-sub">
                    Each lead is scored 0–100 from intent, pages visited, time on site, form
                    completeness and repeat enquiries.
                  </p>
                </div>
                <div className="mw-adv-pill">
                  <Gauge size={14} /> Avg {scores?.average ?? 0}/100
                </div>
              </header>

              <div className="mw-adv-score-summary">
                <span className="mw-score-badge is-hot">
                  <Flame size={13} /> Hot {scores?.hot ?? 0}
                  <small>80–100</small>
                </span>
                <span className="mw-score-badge is-warm">
                  <Thermometer size={13} /> Warm {scores?.warm ?? 0}
                  <small>50–79</small>
                </span>
                <span className="mw-score-badge is-cold">
                  <Snowflake size={13} /> Cold {scores?.cold ?? 0}
                  <small>0–49</small>
                </span>
                <span className="mw-adv-score-note">
                  {scores ? `${scores.scored.length} leads scored` : "Scoring leads…"}
                  {scores?.suspicious ? ` · ${scores.suspicious} suspicious capped at 25` : ""}
                </span>
              </div>

              {topScored.length === 0 ? (
                <p className="mw-adv-empty">
                  {loading
                    ? "Scoring leads…"
                    : "No leads captured yet. Scores appear here as soon as the first enquiry lands."}
                </p>
              ) : (
                <div className="mw-adv-table-wrap">
                  <table className="mw-adv-table">
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Intent</th>
                        <th>Activity</th>
                        <th>Repeat</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topScored.map((item, index) => {
                        const Icon = BAND_ICON[item.band];
                        return (
                          <tr key={`${item.lead.createdAt}-${index}`}>
                            <td>
                              <strong>{item.lead.name || "Unnamed enquiry"}</strong>
                              <div className="mw-adv-rowmeta">
                                {item.lead.mobile || "No mobile"} ·{" "}
                                {item.lead.vehicleName || item.lead.source}
                              </div>
                            </td>
                            <td>{intentLabel(item.lead.type)}</td>
                            <td>{activityLabel(item)}</td>
                            <td>{item.repeatForms > 1 ? `${item.repeatForms} forms` : "—"}</td>
                            <td>
                              <span className={`mw-score-badge ${bandClass(item.band)}`}>
                                <Icon size={13} /> {item.band} {item.score}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {(scores?.scored.length ?? 0) > topScored.length ? (
                <p className="mw-adv-score-foot">
                  Showing the top {topScored.length} of {scores?.scored.length} scored leads.
                </p>
              ) : null}
            </section>

            {/* ------------------------------------------ funnel & traffic */}
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
                    const width = snapshot
                      ? Math.max(12, (step.count / snapshot.funnel[0]!.count) * 100)
                      : 12;
                    return (
                      <div
                        key={step.key}
                        className="mw-adv-funnel-row"
                        style={{ "--w": `${width}%` } as CSSProperties}
                      >
                        <div className="mw-adv-funnel-label">
                          <span className="mw-adv-funnel-dot" />
                          <span>{step.label}</span>
                        </div>
                        <div className="mw-adv-funnel-meta">
                          <span>{step.count.toLocaleString("en-IN")}</span>
                          {step.key !== "visits" ? (
                            <span>−{step.dropOffRate}% drop-off</span>
                          ) : (
                            <span>Entry point</span>
                          )}
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
                {loading && !snapshot ? (
                  <p className="mw-adv-empty">Loading traffic sources…</p>
                ) : null}
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
                          No vehicle view/lead data captured yet. Traffic and events will appear here
                          as visitors browse.
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
                  Forms submitted in &lt; 3 seconds or missing reCAPTCHA are marked Suspicious and
                  listed here separately.
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
                          {lead.fields?.["suspicionReason"] || "Flagged as suspicious"}
                          {lead.fields?.["submitDurationMs"]
                            ? ` • ${Math.round(Number(lead.fields["submitDurationMs"]) / 100) / 10}s`
                            : ""}
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
