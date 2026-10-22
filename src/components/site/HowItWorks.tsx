const STEPS = [
  { title: "Browse Cars", text: "Explore certified pre-owned cars available with Motor Wallah." },
  { title: "Select Your Car", text: "Shortlist the car that fits your budget and requirement." },
  { title: "Book Test Drive", text: "Experience the car before you decide." },
  { title: "Vehicle Inspection", text: "Review the 150+ point vehicle inspection report." },
  { title: "Finance & Insurance", text: "Assistance through relevant lending and insurance partners." },
  { title: "Documentation", text: "RTO and ownership-transfer assistance handled for you." },
  { title: "Vehicle Delivery", text: "Take delivery of your car with complete paperwork." },
  { title: "After-Sales Support", text: "Workshop and service support after your purchase." },
];

export function HowItWorks() {
  return (
    <section className="bg-secondary/50 py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <h2 className="section-title">
          How It <span className="text-primary">Works</span>
        </h2>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border border-border bg-card p-5">
              <span className="font-display text-3xl font-bold text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-sm font-bold uppercase tracking-wide">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
