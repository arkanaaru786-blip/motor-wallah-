import { Car, Eye, HandCoins, PlusCircle, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { dealerCategoryLabel, dealerCategorySingular } from "@/lib/dealer-categories";
import type { DealerBook, DealerKpis } from "@/lib/dealer-data";
import { compactRupees, relativeTime, rupees } from "@/lib/dealer-format";
import type { DealerSession } from "@/lib/dealer-session";
import type { DealerTab } from "./DealerShell";

export function DealerOverview({
  session,
  book,
  kpis,
  onTab,
}: {
  session: DealerSession;
  book: DealerBook;
  kpis: DealerKpis;
  onTab: (tab: DealerTab) => void;
}) {
  const category = dealerCategoryLabel(session.category);
  const singular = dealerCategorySingular(session.category);
  const newLeads = book.leads.filter((lead) => lead.status === "New");
  const pendingOffers = book.offers.filter((offer) => offer.status === "Pending");

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>Welcome back, {session.name.split(" ")[0]}</h1>
          <p>
            Your {category} desk for {session.showroom}. Only your {category.toLowerCase()}{" "}
            inventory, leads and offers appear here.
          </p>
        </div>
        <button type="button" className="mw-dealer-btn is-primary" onClick={() => onTab("add")}>
          <PlusCircle size={15} /> Add {singular}
        </button>
      </div>

      <p className="mw-dealer-scope-note" data-testid="dealer-scope-note">
        <ShieldCheck size={15} />
        <span>
          <strong>{category} only.</strong> Your account is bound to one category by Motor Wallah
          staff, so other categories are not listed, searchable or editable from this portal.
        </span>
      </p>

      <section className="mw-dealer-kpis" aria-label="Your numbers">
        <article className="mw-dealer-kpi is-hero" data-testid="dealer-kpi-listed">
          <header>
            <span className="mw-dealer-kpi-icon" aria-hidden="true">
              <Car size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Total {category} Listed</span>
          </header>
          <strong className="mw-dealer-kpi-value">{kpis.listed}</strong>
          <footer>
            {kpis.active} active · {compactRupees(kpis.inventoryValue)} stock value
          </footer>
        </article>

        <article className="mw-dealer-kpi" data-testid="dealer-kpi-views">
          <header>
            <span className="mw-dealer-kpi-icon" aria-hidden="true">
              <Eye size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Total Views</span>
          </header>
          <strong className="mw-dealer-kpi-value">{kpis.views.toLocaleString("en-IN")}</strong>
          <footer>Across every listing you own</footer>
        </article>

        <article className="mw-dealer-kpi" data-testid="dealer-kpi-leads">
          <header>
            <span className="mw-dealer-kpi-icon" aria-hidden="true">
              <Users size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Total Leads</span>
          </header>
          <strong className="mw-dealer-kpi-value">{kpis.leads}</strong>
          <footer>{newLeads.length} waiting for a first call</footer>
        </article>

        <article className="mw-dealer-kpi" data-testid="dealer-kpi-offers">
          <header>
            <span className="mw-dealer-kpi-icon" aria-hidden="true">
              <HandCoins size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Total Offers</span>
          </header>
          <strong className="mw-dealer-kpi-value">{kpis.offers}</strong>
          <footer>{pendingOffers.length} awaiting your decision</footer>
        </article>
      </section>

      <div className="mw-dealer-panels">
        <section className="mw-dealer-panel">
          <div className="mw-dealer-panel-head">
            <div>
              <h2>
                <Users size={15} /> New leads
              </h2>
              <p>Enquiries on your {category.toLowerCase()} listings.</p>
            </div>
            <button type="button" className="mw-dealer-btn is-small" onClick={() => onTab("leads")}>
              Open leads
            </button>
          </div>
          {newLeads.length === 0 ? (
            <p className="mw-dealer-empty">No new leads right now.</p>
          ) : (
            <ul className="mw-dealer-feed">
              {newLeads.slice(0, 4).map((lead) => (
                <li key={lead.id}>
                  <span>
                    <strong>{lead.customer}</strong> · {lead.vehicleName}
                  </span>
                  <span className="is-meta">{relativeTime(lead.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mw-dealer-panel">
          <div className="mw-dealer-panel-head">
            <div>
              <h2>
                <HandCoins size={15} /> Offers to review
              </h2>
              <p>Accept, reject or counter — the customer sees the same figure.</p>
            </div>
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={() => onTab("offers")}
            >
              Open offers
            </button>
          </div>
          {pendingOffers.length === 0 ? (
            <p className="mw-dealer-empty">No offers waiting.</p>
          ) : (
            <ul className="mw-dealer-feed">
              {pendingOffers.slice(0, 4).map((offer) => (
                <li key={offer.id}>
                  <span>
                    <strong>{rupees(offer.amount)}</strong> for {offer.vehicleName}
                  </span>
                  <span className="is-meta">asking {rupees(offer.askingPrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mw-dealer-panel is-wide">
          <div className="mw-dealer-panel-head">
            <div>
              <h2>
                <TrendingUp size={15} /> Your latest {category.toLowerCase()}
              </h2>
              <p>Views and leads per listing, from your own inventory only.</p>
            </div>
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={() => onTab("inventory")}
            >
              Manage inventory
            </button>
          </div>
          {book.vehicles.length === 0 ? (
            <p className="mw-dealer-empty">Nothing listed yet — add your first {singular}.</p>
          ) : (
            <ul className="mw-dealer-feed">
              {book.vehicles.slice(0, 5).map((vehicle) => (
                <li key={vehicle.id}>
                  <span>
                    <strong>{vehicle.name}</strong> · {vehicle.year} · {rupees(vehicle.price)}
                  </span>
                  <span className="is-meta">
                    {vehicle.views} views · {vehicle.leads} leads · {vehicle.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
