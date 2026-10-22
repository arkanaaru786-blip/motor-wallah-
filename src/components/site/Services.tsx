import { Link } from "@tanstack/react-router";
import {
  BatteryCharging,
  CarFront,
  FileText,
  IndianRupee,
  PaintBucket,
  ShieldCheck,
  Sofa,
  Sparkles,
  Truck,
  Umbrella,
  Wrench,
  BadgeCheck,
} from "lucide-react";

const SERVICES = [
  { icon: ShieldCheck, label: "Vehicle Inspection\n& Certification", to: "/inspection" },
  { icon: IndianRupee, label: "Car\nFinance", to: "/finance" },
  { icon: Umbrella, label: "Insurance\nAssistance", to: "/insurance" },
  { icon: FileText, label: "RTO\nDocumentation", to: "/rto" },
  { icon: CarFront, label: "Complete\nCar Care", to: "/workshop" },
  { icon: Wrench, label: "Mechanical\nWorks", to: "/workshop" },
  { icon: BatteryCharging, label: "Electrical\nWorks", to: "/workshop" },
  { icon: PaintBucket, label: "Denting &\nPainting", to: "/workshop" },
  { icon: Sparkles, label: "Detailing", to: "/workshop" },
  { icon: Sofa, label: "Car\nAccessories", to: "/accessories" },
  { icon: BadgeCheck, label: "Extended\nWarranty", to: "/warranty" },
  { icon: Truck, label: "Roadside\nAssistance", to: "/roadside-assistance" },
] as const;

export function Services() {
  return (
    <section id="services" className="bg-secondary/50 py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <h2 className="section-title">
          Our <span className="text-primary">Services</span>
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {SERVICES.map(({ icon: Icon, label, to }) => (
            <Link
              key={label}
              to={to}
              className="group flex flex-col items-center justify-start gap-3 border border-border bg-card px-3 py-5 text-center transition-all hover:-translate-y-1 hover:border-primary hover:shadow-panel"
            >
              <Icon className="h-7 w-7 text-foreground transition-colors group-hover:text-primary" strokeWidth={1.5} />
              <span className="whitespace-pre-line text-[0.68rem] font-semibold leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/services"
            className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Explore All Services
          </Link>
          <Link
            to="/book-service"
            className="inline-flex items-center justify-center gap-2 border border-border bg-card px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
          >
            Book Service
          </Link>
        </div>
      </div>
    </section>
  );
}
