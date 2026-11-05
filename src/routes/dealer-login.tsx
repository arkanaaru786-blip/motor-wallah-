import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck, Store } from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import { currentDealer, signInDealer, useDealerSession } from "@/lib/dealer-session";
import { DEMO_DEALER_PASSWORD, ensureDealers, listDealers, type Dealer } from "@/lib/dealers";

export const Route = createFileRoute("/dealer-login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (currentDealer()) throw redirect({ to: "/dealer" });
  },
  head: () => ({
    meta: [
      { title: "Dealer Login | Motor Wallah" },
      {
        name: "description",
        content: "Category-restricted dealer portal for Motor Wallah partners.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DealerLoginRoute,
});

function DealerLoginRoute() {
  const { ready, session } = useDealerSession();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seeded once per browser: one working login per vehicle category.
  useEffect(() => {
    let cancelled = false;
    void ensureDealers().then(() => {
      if (!cancelled) setDealers(listDealers());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/dealer", replace: true });
  }, [ready, session, navigate]);

  return (
    <div className="mw-dealer mw-dealer-login">
      <div className="mw-dealer-login-card">
        <div className="mw-dealer-login-main">
          <div className="mw-dealer-brand">
            <span className="mw-dealer-brand-mark" aria-hidden="true">
              <Store size={19} />
            </span>
            <div>
              <strong>Motor Wallah Dealer Portal</strong>
              <span>Inventory, leads and offers — for your category only</span>
            </div>
          </div>

          <div>
            <h1>Dealer sign in</h1>
            <p className="mw-dealer-login-lede">
              Use the email and password issued by Motor Wallah. Your account is bound to one
              vehicle category; the portal opens directly on that category&apos;s inventory and
              leads.
            </p>
          </div>

          <form
            className="mw-dealer-form"
            style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setBusy(true);
              const result = await signInDealer(email, password);
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              void navigate({ to: "/dealer" });
            }}
            data-testid="dealer-login-form"
          >
            <label className="mw-dealer-field">
              <span>Dealer email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="cars@dealer.motorwallah.in"
                autoComplete="username"
                required
                data-testid="dealer-login-email"
              />
            </label>

            <label className="mw-dealer-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                data-testid="dealer-login-password"
              />
            </label>

            {error ? (
              <p className="mw-dealer-error" role="alert" data-testid="dealer-login-error">
                {error}
              </p>
            ) : null}

            <div className="mw-dealer-form-actions">
              <button
                type="submit"
                className="mw-dealer-btn is-primary"
                disabled={busy}
                data-testid="dealer-login-submit"
              >
                <KeyRound size={15} /> {busy ? "Checking…" : "Sign in"}
              </button>
              <Link to="/master-admin/login" className="mw-dealer-link">
                Staff login <ArrowRight size={13} />
              </Link>
            </div>
          </form>
        </div>

        <aside className="mw-dealer-login-aside">
          <h2>Demo dealer logins</h2>
          <p className="mw-dealer-demo-note">
            One account per category, created for this mock setup. Click one to fill the form — all
            use the password <code>{DEMO_DEALER_PASSWORD}</code>.
          </p>
          <ul className="mw-dealer-demo-list">
            {dealers.map((dealer) => (
              <li key={dealer.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(dealer.email);
                    setPassword(DEMO_DEALER_PASSWORD);
                    setError(null);
                  }}
                  data-testid={`dealer-demo-${dealer.category}`}
                >
                  <strong>{dealerCategoryLabel(dealer.category)}</strong>
                  <span>
                    {dealer.status} · {dealer.email}
                  </span>
                </button>
              </li>
            ))}
            {dealers.length === 0 ? (
              <li className="mw-dealer-demo-note">Preparing demo dealer accounts…</li>
            ) : null}
          </ul>
          <p className="mw-dealer-demo-note">
            <ShieldCheck size={13} /> Each login sees only its own category: a Cars dealer has no
            Bikes, Trucks or Taxi anywhere in the portal.
          </p>
        </aside>
      </div>
    </div>
  );
}
