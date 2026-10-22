import { BadgeIndianRupee, Clock, FileText, IndianRupee, ShieldCheck, Umbrella } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, title: "Certified Quality", text: "Every vehicle undergoes a 150+ point inspection." },
  { icon: BadgeIndianRupee, title: "Transparent Pricing", text: "Fair and transparent vehicle pricing." },
  { icon: IndianRupee, title: "Easy Finance", text: "Finance assistance through relevant lending partners." },
  { icon: Umbrella, title: "Insurance Support", text: "Insurance assistance through relevant providers." },
  { icon: FileText, title: "Complete Documentation", text: "RTO and ownership-transfer assistance." },
  { icon: Clock, title: "Roadside Assistance", text: "Roadside assistance available through service partners." },
];

export function WhyChoose() {
  return (
    <section id="why" className="bg-background py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <h2 className="section-title">
          Why Choose <span className="text-primary">Motor Wallah?</span>
        </h2>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="border border-border bg-card p-6">
              <Icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
              <h3 className="mt-4 text-sm font-bold uppercase tracking-wide">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
