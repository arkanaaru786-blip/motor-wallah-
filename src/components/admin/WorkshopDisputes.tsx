import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert, Wallet } from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { inr, relativeTime } from "@/lib/admin-crm";
import { actorFromSession, can } from "@/lib/admin-rbac";
import {
  DISPUTE_EVENT,
  openDisputeCount,
  resolveWorkshopDispute,
  workshopDisputes,
} from "@/lib/workshop-disputes";

/**
 * Admin queue for cash / offline payment reports raised from Track Service.
 * Disputes are deliberately separate from the workshop repair status so the
 * team can review the complaint without stopping the customer's job.
 */
export function WorkshopDisputes({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const canResolve = can(actor, "case.update_status");
  const [version, setVersion] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener(DISPUTE_EVENT, refresh);
    const timer = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => {
      window.removeEventListener(DISPUTE_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    void version;
    return workshopDisputes();
  }, [version]);

  const open = rows.filter((row) => row.status === "Open");
  const resolved = rows.filter((row) => row.status === "Resolved");
  const disputedValue = open.reduce((sum, row) => sum + row.amount, 0);

  const resolve = (id: string) => {
    const result = resolveWorkshopDispute(
      id,
      session.name,
      notes[id] ?? "Reviewed and closed by the admin team.",
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotes((current) => ({ ...current, [id]: "" }));
    setVersion((value) => value + 1);
  };

  return (
    <div className="mw-admin-disputes" data-testid="workshop-disputes">
      {error ? (
        <p className="mw-admin-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mw-admin-bento mw-admin-dispute-kpis">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldAlert size={18} />
            </span>
            <span className="mw-admin-kpi-label">Open disputes</span>
          </header>
          <p className="mw-admin-kpi-value" data-testid="disputes-open">
            {openDisputeCount()}
          </p>
          <footer>
            <span>{rows.length} total reports</span>
            <span className="mw-admin-kpi-sub">Cash / offline payment complaints</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Wallet size={18} />
            </span>
            <span className="mw-admin-kpi-label">Amount in review</span>
          </header>
          <p className="mw-admin-kpi-value">{inr(disputedValue)}</p>
          <footer>
            <span>Across open disputes</span>
            <span className="mw-admin-kpi-sub">Never collect this offline</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <CheckCircle2 size={18} />
            </span>
            <span className="mw-admin-kpi-label">Resolved</span>
          </header>
          <p className="mw-admin-kpi-value">{resolved.length}</p>
          <footer>
            <span>Closed with a note</span>
            <span className="mw-admin-kpi-sub">Full audit trail in the dispute</span>
          </footer>
        </article>
      </section>

      <section className="mw-admin-panel" aria-labelledby="dispute-queue">
        <header className="mw-admin-panel-head">
          <div>
            <h2 id="dispute-queue">
              <AlertTriangle size={16} /> Workshop payment disputes
            </h2>
            <p>
              Reports raised by customers when a workshop asks for cash or an offline payment.
              Online prepaid payment is mandatory.
            </p>
          </div>
          <span className="mw-admin-chip is-danger">{open.length} open</span>
        </header>

        {rows.length === 0 ? (
          <p className="mw-admin-empty" data-testid="disputes-empty">
            No workshop disputes have been reported.
          </p>
        ) : (
          <div className="mw-admin-dispute-list">
            {rows.map((dispute) => (
              <article
                key={dispute.id}
                className="mw-admin-dispute"
                data-testid={`dispute-${dispute.id}`}
                data-status={dispute.status}
              >
                <div className="mw-admin-dispute-head">
                  <div>
                    <span
                      className={`mw-admin-chip ${
                        dispute.status === "Open" ? "is-danger" : "is-ok"
                      }`}
                    >
                      {dispute.status}
                    </span>
                    <strong>{dispute.workshopName}</strong>
                    <small>
                      {dispute.id} · reported {relativeTime(dispute.createdAt, tick)}
                    </small>
                  </div>
                  <span className="mw-admin-dispute-amount">{inr(dispute.amount)}</span>
                </div>

                <div className="mw-admin-dispute-facts">
                  <div>
                    <span>Customer</span>
                    <strong>{dispute.customerName}</strong>
                    <small>{dispute.customerMobile}</small>
                  </div>
                  <div>
                    <span>Vehicle</span>
                    <strong>{dispute.vehicleNumber}</strong>
                    <small>{dispute.vehicle}</small>
                  </div>
                  <div>
                    <span>Booking</span>
                    <strong>{dispute.trackingId}</strong>
                    <small>Workshop enquiry {dispute.enquiryId}</small>
                  </div>
                  <div>
                    <span>Partner</span>
                    <strong>{dispute.partnerId || "—"}</strong>
                    <small>Workshop account</small>
                  </div>
                </div>

                <p className="mw-admin-dispute-reason">
                  <AlertTriangle size={14} /> {dispute.reason}
                </p>

                {dispute.status === "Open" ? (
                  <div className="mw-admin-dispute-resolve">
                    <label>
                      <span>Resolution note</span>
                      <textarea
                        rows={2}
                        value={notes[dispute.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [dispute.id]: event.target.value,
                          }))
                        }
                        placeholder="Call the workshop, confirm the prepaid rule, close the report…"
                        maxLength={500}
                      />
                    </label>
                    <button
                      type="button"
                      className="mw-admin-submit"
                      disabled={!canResolve}
                      onClick={() => resolve(dispute.id)}
                      data-testid={`dispute-resolve-${dispute.id}`}
                    >
                      <CheckCircle2 size={14} /> Resolve dispute
                    </button>
                    {!canResolve ? (
                      <small className="mw-admin-dispute-locked">
                        Your role can view this dispute but cannot resolve it.
                      </small>
                    ) : null}
                  </div>
                ) : (
                  <div className="mw-admin-dispute-resolution">
                    <CheckCircle2 size={14} />
                    <div>
                      <strong>Resolved by {dispute.resolvedBy ?? "admin"}</strong>
                      <p>{dispute.resolution}</p>
                      {dispute.resolvedAt ? (
                        <small>{relativeTime(dispute.resolvedAt, tick)}</small>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="mw-admin-dispute-actions">
                  <Link to="/track" search={{ id: dispute.trackingId }} className="mw-admin-link">
                    Open customer tracking <ExternalLink size={13} />
                  </Link>
                  <a href={`tel:${dispute.customerMobile}`} className="mw-admin-link">
                    Call customer
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
