import { CheckCircle2, Building2 } from "lucide-react";

const POINTS = [
  ["Trusted Brand", "Quality Assurance"],
  ["Modern Facilities", "Transparent Pricing"],
  ["Complete Solutions", "Madhya Pradesh Focus"],
];

export function UnderOneRoof() {
  return (
    <section className="bg-background pb-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="flex flex-col gap-8 bg-ink px-6 py-8 text-ink-foreground lg:flex-row lg:items-center lg:px-10">
          <div className="border-l-4 border-primary pl-5 lg:w-1/3">
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
              Everything your car needs,
              <br />
              <span className="text-primary">under one roof.</span>
            </h2>
          </div>

          <div className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-3">
            {POINTS.map((col, i) => (
              <ul key={i} className="space-y-3">
                {col.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-ink-foreground/85">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            ))}
          </div>

          <div className="flex items-center gap-4 border-ink-foreground/20 lg:border-l lg:pl-8">
            <Building2 className="h-10 w-10 shrink-0 text-primary" strokeWidth={1.5} />
            <p className="font-display text-lg leading-tight">
              150+ Point Inspection
              <span className="block text-sm font-normal text-ink-foreground/70">On Every Car</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
