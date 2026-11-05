import { useState } from "react";
import { Check, HandCoins, MessageSquare, Send, X } from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import { respondToOffer, type DealerOffer } from "@/lib/dealer-data";
import { relativeTime, rupees } from "@/lib/dealer-format";
import type { DealerSession } from "@/lib/dealer-session";

const CHIP: Record<DealerOffer["status"], string> = {
  Pending: "is-pending",
  Accepted: "is-accepted",
  Rejected: "is-rejected",
  "Counter Offer": "is-counter",
};

export function DealerOffers({
  session,
  offers,
  refresh,
}: {
  session: DealerSession;
  offers: DealerOffer[];
  refresh: () => void;
}) {
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = offers.filter((offer) => offer.status === "Pending").length;

  const act = (offer: DealerOffer, action: "accept" | "reject") => {
    const result = respondToOffer(session, offer.id, action);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setCounterFor(null);
    refresh();
  };

  const sendCounter = (offer: DealerOffer) => {
    const result = respondToOffer(session, offer.id, "counter", Number(counterValue));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setCounterFor(null);
    setCounterValue("");
    refresh();
  };

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>Offers</h1>
          <p>
            {pending} {pending === 1 ? "offer needs" : "offers need"} a decision. Accept, reject or
            send a counter offer — the customer's figure is never changed by accepting.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mw-dealer-error" role="alert" data-testid="offer-error">
          {error}
        </p>
      ) : null}

      <section className="mw-dealer-panel is-wide">
        <div className="mw-dealer-panel-head">
          <div>
            <h2>
              <HandCoins size={15} /> Offers on your {dealerCategoryLabel(session.category)}{" "}
              listings ({offers.length})
            </h2>
            <p>Every offer made through the public listing page lands here.</p>
          </div>
        </div>

        {offers.length === 0 ? (
          <p className="mw-dealer-empty">No offers yet.</p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="offers-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Offer</th>
                  <th scope="col">Asking</th>
                  <th scope="col">Received</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id} data-testid={`offer-row-${offer.id}`}>
                    <td>
                      <strong>{offer.customer}</strong>
                      <div className="is-muted">{offer.mobile}</div>
                    </td>
                    <td>
                      {offer.vehicleName}
                      {offer.message ? <div className="is-muted">“{offer.message}”</div> : null}
                    </td>
                    <td className="is-num">{rupees(offer.amount)}</td>
                    <td className="is-muted">{rupees(offer.askingPrice)}</td>
                    <td className="is-muted">{relativeTime(offer.createdAt)}</td>
                    <td>
                      <span className={`mw-dealer-chip ${CHIP[offer.status]}`}>{offer.status}</span>
                      {offer.counterAmount ? (
                        <div className="is-muted">counter {rupees(offer.counterAmount)}</div>
                      ) : null}
                    </td>
                    <td>
                      {offer.status === "Pending" ? (
                        counterFor === offer.id ? (
                          <div className="mw-dealer-inline-form">
                            <input
                              type="number"
                              min={1000}
                              step={1000}
                              value={counterValue}
                              onChange={(event) => setCounterValue(event.target.value)}
                              placeholder="Counter ₹"
                              aria-label={`Counter amount for ${offer.customer}`}
                              data-testid="offer-counter-input"
                            />
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-primary"
                              onClick={() => sendCounter(offer)}
                              data-testid="offer-counter-send"
                            >
                              <Send size={13} /> Send
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-quiet"
                              onClick={() => setCounterFor(null)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="mw-dealer-actions">
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              onClick={() => act(offer, "accept")}
                              data-testid="offer-accept"
                            >
                              <Check size={13} /> Accept
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-danger"
                              onClick={() => act(offer, "reject")}
                              data-testid="offer-reject"
                            >
                              <X size={13} /> Reject
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              onClick={() => {
                                setCounterFor(offer.id);
                                setCounterValue(
                                  String(Math.round((offer.amount + offer.askingPrice) / 2)),
                                );
                                setError(null);
                              }}
                              data-testid="offer-counter"
                            >
                              <MessageSquare size={13} /> Counter
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          type="button"
                          className="mw-dealer-btn is-small is-quiet"
                          onClick={() => {
                            setCounterFor(offer.id);
                            setCounterValue(String(offer.askingPrice));
                          }}
                        >
                          Counter again
                        </button>
                      )}
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
