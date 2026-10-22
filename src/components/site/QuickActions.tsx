import { Link } from "@tanstack/react-router";
import { Car, HandCoins, IndianRupee, Repeat, Wrench } from "lucide-react";

const ACTIONS = [
  { icon: Car, label: "Buy a Car", to: "/cars" },
  { icon: HandCoins, label: "Sell Your Car", to: "/sell-your-car" },
  { icon: Repeat, label: "Exchange", to: "/exchange" },
  { icon: IndianRupee, label: "Finance", to: "/finance" },
  { icon: Wrench, label: "Book Service", to: "/book-service" },
] as const;

export function QuickActions() {
  return (
    <section className="bg-background py-10">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ACTIONS.map(({ icon: Icon, label, to }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 border border-border bg-card px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-panel"
            >
              <Icon className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.5} />
              <span className="min-w-0 text-xs font-bold uppercase tracking-wide">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
