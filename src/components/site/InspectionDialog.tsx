import { Check, ShieldCheck, X } from "lucide-react";
import { type Vehicle } from "@/lib/cars-data";

export function InspectionDialog({
  vehicle,
  open,
  onClose,
}: {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const report = vehicle.inspection;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/70" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-xl uppercase leading-tight">MOTOR WALLAH CERTIFIED</p>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">150+ POINT QUALITY INSPECTION</p>
            </div>
          </div>
          <button type="button" aria-label="Close certification" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Vehicle assessed through the MOTOR WALLAH quality evaluation process.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            "Quality Checked",
            "Vehicle Condition Assessed",
            "Documentation Checked",
            "Road Test Assessed",
          ].map((label) => (
            <span
              key={label}
              className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              {label}
            </span>
          ))}
        </div>

        {report?.inspectedOn && (
          <div className="mt-5 border-t border-border pt-3 text-sm text-muted-foreground">
            <p>
              Inspection Date:{" "}
              <span className="font-semibold text-foreground">{report.inspectedOn}</span>
            </p>
            {report.certificationId && (
              <p className="mt-1">
                Certification ID:{" "}
                <span className="font-semibold text-foreground">{report.certificationId}</span>
              </p>
            )}
          </div>
        )}

        {vehicle.demo && (
          <p className="mt-5 border border-primary/40 bg-primary/10 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-primary">
            DEMO CERTIFICATION — This is not a real completed vehicle inspection.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
