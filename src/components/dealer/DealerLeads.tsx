import { MessageCircle, Phone, Users } from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import { setLeadStatus, type DealerLead } from "@/lib/dealer-data";
import { relativeTime, shortDate } from "@/lib/dealer-format";
import type { DealerSession } from "@/lib/dealer-session";

const telHref = (mobile: string) => `tel:+91${mobile}`;
const chatHref = (lead: DealerLead) =>
  `https://wa.me/91${lead.mobile}?text=${encodeURIComponent(
    `Hello ${lead.customer}, this is ${lead.vehicleName} listing support from Motor Wallah.`,
  )}`;

export function DealerLeads({
  session,
  leads,
  refresh,
}: {
  session: DealerSession;
  leads: DealerLead[];
  refresh: () => void;
}) {
  const open = leads.filter((lead) => lead.status !== "Closed").length;

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>Leads</h1>
          <p>
            {open} open {open === 1 ? "lead" : "leads"} on your{" "}
            {dealerCategoryLabel(session.category).toLowerCase()} listings. Call or chat straight
            from the row.
          </p>
        </div>
      </div>

      <section className="mw-dealer-panel is-wide">
        <div className="mw-dealer-panel-head">
          <div>
            <h2>
              <Users size={15} /> Lead pipeline ({leads.length})
            </h2>
            <p>Customer, mobile, interested vehicle, date and location.</p>
          </div>
        </div>

        {leads.length === 0 ? (
          <p className="mw-dealer-empty">
            No leads yet. They appear here as soon as a customer enquires.
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="leads-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Interested vehicle</th>
                  <th scope="col">Date</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col">Call &amp; chat</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} data-testid={`lead-row-${lead.id}`}>
                    <td>
                      <strong>{lead.customer}</strong>
                      <div className="is-muted">{lead.source}</div>
                    </td>
                    <td className="is-num">{lead.mobile}</td>
                    <td>{lead.vehicleName}</td>
                    <td>
                      <span>{shortDate(lead.date)}</span>
                      <div className="is-muted">{relativeTime(lead.date)}</div>
                    </td>
                    <td>{lead.location}</td>
                    <td>
                      <select
                        className="mw-dealer-chip"
                        aria-label={`Status for ${lead.customer}`}
                        value={lead.status}
                        onChange={(event) => {
                          setLeadStatus(
                            session,
                            lead.id,
                            event.target.value as DealerLead["status"],
                          );
                          refresh();
                        }}
                        style={{ padding: "3px 8px" }}
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td>
                      <div className="mw-dealer-actions">
                        <a
                          className="mw-dealer-btn is-small"
                          href={telHref(lead.mobile)}
                          data-testid="lead-call"
                        >
                          <Phone size={13} /> Call
                        </a>
                        <a
                          className="mw-dealer-btn is-small"
                          href={chatHref(lead)}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="lead-chat"
                        >
                          <MessageCircle size={13} /> Chat
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
