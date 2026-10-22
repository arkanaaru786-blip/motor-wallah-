import { Link } from "@tanstack/react-router";
import { Fuel, Gauge, MessageCircle, Settings2, ShieldCheck } from "lucide-react";
import carSuv from "@/assets/car-suv.jpg";
import carSedan from "@/assets/car-sedan.jpg";
import carHatch from "@/assets/car-hatch.jpg";
import { whatsappLink } from "@/lib/site";

type Vehicle = {
  id: string;
  name: string;
  year: number;
  km: string;
  fuel: string;
  transmission: string;
  price: string;
  image: string;
};

// Placeholder inventory — replace with data from the vehicle database later.
const VEHICLES: Vehicle[] = [
  { id: "mw-01", name: "Hyundai Creta SX", year: 2021, km: "38,400 km", fuel: "Petrol", transmission: "Manual", price: "₹12.85 Lakh", image: carSuv },
  { id: "mw-02", name: "Honda City VX", year: 2020, km: "44,100 km", fuel: "Petrol", transmission: "Automatic", price: "₹9.75 Lakh", image: carSedan },
  { id: "mw-03", name: "Maruti Suzuki Baleno Zeta", year: 2022, km: "21,600 km", fuel: "Petrol", transmission: "Manual", price: "₹7.40 Lakh", image: carHatch },
  { id: "mw-04", name: "Mahindra Scorpio N Z8", year: 2022, km: "29,800 km", fuel: "Diesel", transmission: "Manual", price: "₹18.20 Lakh", image: carSuv },
  { id: "mw-05", name: "Tata Nexon XZ+", year: 2021, km: "33,250 km", fuel: "Diesel", transmission: "Manual", price: "₹9.10 Lakh", image: carHatch },
  { id: "mw-06", name: "Toyota Innova Crysta GX", year: 2019, km: "62,900 km", fuel: "Diesel", transmission: "Automatic", price: "₹16.50 Lakh", image: carSedan },
];

export function FeaturedCars() {
  return (
    <section className="bg-background py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <h2 className="section-title">
          Featured <span className="text-primary">Cars</span>
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {VEHICLES.map((v) => (
            <article key={v.id} className="flex flex-col border border-border bg-card">
              <div className="relative">
                <img
                  src={v.image}
                  alt={`${v.name} available at Motor Wallah`}
                  width={1024}
                  height={640}
                  loading="lazy"
                  className="aspect-[16/10] w-full object-cover"
                />
                <span className="absolute left-0 top-3 bg-primary px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-primary-foreground">
                  Certified
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold leading-tight">{v.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{v.year}</p>

                <ul className="mt-4 grid grid-cols-3 gap-2 text-[0.68rem] font-semibold">
                  <li className="flex min-w-0 items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{v.km}</span>
                  </li>
                  <li className="flex min-w-0 items-center gap-1.5">
                    <Fuel className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{v.fuel}</span>
                  </li>
                  <li className="flex min-w-0 items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{v.transmission}</span>
                  </li>
                </ul>

                <p className="mt-4 inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> 150+ Point Inspection
                </p>

                <p className="mt-4 font-display text-2xl font-bold text-primary">{v.price}</p>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link
                    to="/cars"
                    className="inline-flex items-center justify-center bg-primary px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary-foreground"
                  >
                    View Details
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center border border-border px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
                  >
                    Book Test Drive
                  </Link>
                  <a
                    href={whatsappLink(`Hi Motor Wallah, I am interested in the ${v.name} (${v.year}).`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 border border-border px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary sm:col-span-2"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/cars"
            className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
          >
            View All Cars
          </Link>
        </div>
      </div>
    </section>
  );
}
