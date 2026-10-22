import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Car, Fuel, Gauge, MapPin, MessageCircle, Phone, Settings2 } from "lucide-react";
import { formatKm, formatPrice, vehicleName, type Vehicle } from "@/lib/cars-data";
import { PHONE_HREF, whatsappLink } from "@/lib/site";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { InspectionDialog } from "@/components/site/InspectionDialog";
import { TestDriveDialog } from "@/components/site/TestDriveDialog";
import { submitLead } from "@/lib/leads";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const [testDrive, setTestDrive] = useState(false);
  const [inspection, setInspection] = useState(false);
  const name = vehicleName(vehicle);
  const sold = vehicle.status === "Sold";

  return (
    <article className="flex min-w-0 flex-col border border-border bg-card shadow-panel">
      <VehicleGallery
        images={vehicle.images}
        alt={`${vehicle.bodyType} demo placeholder photo for ${name}`}
        allowFullscreen={false}
        showThumbnails={false}
        overlay={
          <>
            <div className="absolute left-0 top-0 flex flex-col items-start gap-1 p-2">
              <span className="bg-primary px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-primary-foreground">
                Motor Wallah Certified
              </span>
              <button
                type="button"
                onClick={() => setInspection(true)}
                className="bg-ink px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-ink-foreground underline-offset-2 hover:underline"
              >
                150+ Point Inspection
              </button>
              {vehicle.demo && (
                <span className="border border-border bg-card px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide">
                  Demo Listing
                </span>
              )}
            </div>
            <span
              className={`absolute right-2 top-2 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-wide ${
                vehicle.status === "Available"
                  ? "bg-card text-foreground"
                  : "bg-ink text-ink-foreground"
              }`}
            >
              {vehicle.status}
            </span>
          </>
        }
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="font-display text-lg uppercase leading-tight">{name}</h2>
        <p className="mt-1 text-xl font-bold text-primary">{formatPrice(vehicle.price)}</p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 shrink-0 text-primary" />{formatKm(vehicle.kilometres)}</div>
          <div className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5 shrink-0 text-primary" />{vehicle.fuel}</div>
          <div className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 shrink-0 text-primary" />{vehicle.transmission}</div>
          <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />{vehicle.location}</div>
          <div className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5 shrink-0 text-primary" />{vehicle.bodyType}</div>
        </dl>

        <div className="mt-auto grid gap-2 pt-4">
          <Link
            to="/cars/$id"
            params={{ id: vehicle.slug }}
            className="bg-primary px-4 py-3 text-center text-[0.7rem] font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            View Details
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={sold}
              onClick={() => setTestDrive(true)}
              className="border border-border px-3 py-3 text-center text-[0.7rem] font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              {sold ? "Sold" : "Book Test Drive"}
            </button>
            <a
              href={whatsappLink(
                `Hello MOTOR WALLAH, I am interested in the ${name} priced at ${formatPrice(vehicle.price)}. I would like to know more about this vehicle.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                submitLead({ type: "whatsapp_click", source: "inventory_card", vehicleId: vehicle.id, vehicleName: name })
              }
              className="flex items-center justify-center gap-1.5 border border-border px-3 py-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
          <a
            href={PHONE_HREF}
            onClick={() =>
              submitLead({ type: "call_click", source: "inventory_card", vehicleId: vehicle.id, vehicleName: name })
            }
            className="flex items-center justify-center gap-1.5 py-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
          >
            <Phone className="h-3.5 w-3.5" /> Call our team
          </a>
        </div>
      </div>

      <TestDriveDialog vehicle={vehicle} open={testDrive} onClose={() => setTestDrive(false)} />
      <InspectionDialog vehicle={vehicle} open={inspection} onClose={() => setInspection(false)} />
    </article>
  );
}
