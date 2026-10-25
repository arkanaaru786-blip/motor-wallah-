import { useState } from "react";
import { X } from "lucide-react";
import { type Vehicle, vehicleName } from "@/lib/cars-data";
import { submitLead, type LeadType } from "@/lib/leads";

export type EnquiryField = {
  name: string;
  label: string;
  type?: "text" | "tel" | "number" | "date" | "time" | "textarea" | "select";
  options?: readonly string[];
  required?: boolean;
  defaultValue?: string;
};

/** Generic, config-driven enquiry modal — powers test drive, finance, insurance and warranty leads. */
export function EnquiryDialog({
  open,
  onClose,
  title,
  subtitle,
  fields,
  submitLabel,
  leadType,
  source,
  vehicle,
  subject,
  disclaimer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fields: EnquiryField[];
  submitLabel: string;
  leadType: LeadType;
  source: string;
  vehicle?: Vehicle;
  /** Lightweight alternative for listings that are not in the car dataset. */
  subject?: { id: string; name: string; location?: string | undefined };
  disclaimer?: string;
}) {
  const [done, setDone] = useState(false);
  if (!open) return null;
  const subjectName = vehicle ? vehicleName(vehicle) : subject?.name;
  const subjectLocation = vehicle?.location ?? subject?.location;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/70" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-card/85 p-5 backdrop-blur-[10px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl uppercase leading-tight">{title}</p>
            {(subtitle || subjectName) && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle ?? subjectName}</p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <p className="font-display text-2xl uppercase text-primary">Request received.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you. Our Motor Wallah team will contact you shortly to confirm.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const values: Record<string, string> = {};
              data.forEach((v, k) => (values[k] = String(v)));
              await submitLead({
                type: leadType,
                source,
                vehicleId: vehicle?.id ?? subject?.id,
                vehicleName: subjectName,
                location: subjectLocation,
                name: values["name"],
                mobile: values["mobile"],
                fields: values,
              });
              setDone(true);
            }}
          >
            {subjectName && (
              <label className="block border border-border bg-secondary/40 px-3 py-2">
                <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Vehicle
                </span>
                <input
                  readOnly
                  name="vehicle"
                  value={subjectName}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </label>
            )}
            {fields.map((f) => (
              <label key={f.name} className="block border border-border px-3 py-2">
                <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </span>
                {f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none bg-transparent text-sm outline-none"
                  />
                ) : f.type === "select" ? (
                  <select
                    name={f.name}
                    defaultValue={f.defaultValue}
                    required={f.required}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? "text"}
                    required={f.required}
                    maxLength={f.type === "tel" ? 15 : 100}
                    pattern={f.type === "tel" ? "[0-9+ ]{10,15}" : undefined}
                    defaultValue={f.defaultValue}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                )}
              </label>
            ))}
            {disclaimer && <p className="text-[0.7rem] text-muted-foreground">{disclaimer}</p>}
            <button
              type="submit"
              className="mt-1 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
