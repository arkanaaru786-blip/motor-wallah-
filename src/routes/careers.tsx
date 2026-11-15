import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Mail } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { submitLead } from "@/lib/leads";
import { SUPPORT_EMAIL } from "@/lib/site";
import { loadOpenVacancies } from "@/lib/job-vacancies";

const TITLE = "Careers | Motor Wallah";
const DESCRIPTION =
  "Build your career with the Motor Wallah team in Indore — sales, inspection, workshop, marketing and operations roles.";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Position = { role: string; team: string; location: string; type: string; text: string };

/** Shown until the control room publishes its first vacancy. */
const BUILT_IN_POSITIONS: Position[] = [
  {
    role: "Vehicle Inspection Engineer",
    team: "Quality & Inspection",
    location: "Indore",
    type: "Full-time",
    text: "Run multi-point inspections, document findings and keep the verified badge honest.",
  },
  {
    role: "Sales Executive — Pre-owned Vehicles",
    team: "Marketplace",
    location: "Indore",
    type: "Full-time",
    text: "Guide buyers from enquiry to delivery and keep the listing pipeline moving.",
  },
  {
    role: "Workshop Technician",
    team: "Service",
    location: "Indore",
    type: "Full-time",
    text: "Handle service, diagnosis and reconditioning work for marketplace vehicles.",
  },
  {
    role: "Digital Marketing Associate",
    team: "Marketing",
    location: "Indore / Hybrid",
    type: "Full-time",
    text: "Own campaigns, content and the marketplace's brand presence across channels.",
  },
  {
    role: "Operations Coordinator",
    team: "Operations",
    location: "Indore",
    type: "Full-time",
    text: "Coordinate inspections, pickups, documentation and partner schedules.",
  },
];

type Status = "idle" | "sending" | "sent" | "error";

function Page() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [positions, setPositions] = useState<Position[]>(BUILT_IN_POSITIONS);
  const [role, setRole] = useState<string>(BUILT_IN_POSITIONS[0]!.role);
  const [experience, setExperience] = useState("0-2 years");
  const [resume, setResume] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Vacancies published in Master Admin → Job Vacancies own this list. If the
  // table is unavailable or empty, the built-in roles keep the page useful.
  useEffect(() => {
    let alive = true;
    void loadOpenVacancies().then((result) => {
      if (!alive || result.vacancies.length === 0) return;
      const next = result.vacancies.map((vacancy) => ({
        role: vacancy.title,
        team: vacancy.department || "Motor Wallah",
        location: vacancy.location || "Indore",
        type: vacancy.employmentType || "Full-time",
        text: vacancy.description,
      }));
      setPositions(next);
      setRole((current) => (next.some((item) => item.role === current) ? current : next[0]!.role));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !/^[\d+\s-]{8,}$/.test(mobile.trim())) {
      setError("Enter your name and a valid mobile number.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address, or leave it blank.");
      return;
    }

    setStatus("sending");
    try {
      await submitLead({
        type: "general_enquiry",
        source: "careers",
        name: name.trim(),
        mobile: mobile.trim(),
        fields: {
          kind: "career_application",
          position: role,
          experience,
          email: email.trim(),
          resume: resume.trim(),
          message: message.trim(),
        },
      });
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("The application could not be sent. Please try again or email us directly.");
    }
  }

  return (
    <div className="mw-home min-h-screen bg-background pb-16 md:pb-0">
      <SiteHeader />
      <main className="mw-info">
        <section className="mw-info-hero">
          <div className="home-container">
            <p className="mw-info-eyebrow">
              <BriefcaseBusiness size={14} /> Careers at Motor Wallah
            </p>
            <h1>
              Build the marketplace <span>with us.</span>
            </h1>
            <p className="mw-info-lede">
              We are a young team in Indore working on vehicle retail, inspection, service and
              partnerships. If you like solving practical problems for real customers, there is a
              place for you here.
            </p>
          </div>
        </section>

        <section className="mw-info-section">
          <div className="home-container">
            <div className="mw-info-heading">
              <p className="mw-info-kicker">Open positions</p>
              <h2>
                Roles we are <span>hiring now.</span>
              </h2>
            </div>
            <div className="mw-jobs">
              {positions.map((position) => (
                <article key={position.role} className="mw-job">
                  <div>
                    <h3>{position.role}</h3>
                    <p>{position.text}</p>
                    <p className="mw-job-meta">
                      <span>{position.team}</span>
                      <span>
                        <MapPin size={12} /> {position.location}
                      </span>
                      <span>{position.type}</span>
                    </p>
                  </div>
                  <a href="#apply" className="mw-job-apply">
                    Apply <ArrowRight size={13} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mw-info-section mw-info-section--last" id="apply">
          <div className="home-container">
            <div className="mw-apply">
              <div className="mw-apply-intro">
                <p className="mw-info-kicker">Application</p>
                <h2>Tell us about you.</h2>
                <p>
                  Fill this in and the team will get back to you. You can also send your CV to{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                </p>
              </div>

              {status === "sent" ? (
                <div className="mw-apply-success" role="status">
                  <CheckCircle2 size={20} />
                  <div>
                    <h3>Application received</h3>
                    <p>
                      Thanks, {name.trim().split(" ")[0] || "there"}. Our team will contact you on{" "}
                      {mobile.trim()} about the {role} role.
                    </p>
                  </div>
                </div>
              ) : (
                <form className="mw-apply-form" onSubmit={handleSubmit} noValidate>
                  <div className="mw-apply-grid">
                    <label className="mw-info-field">
                      <span>Full name</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        required
                      />
                    </label>
                    <label className="mw-info-field">
                      <span>Mobile number</span>
                      <input
                        value={mobile}
                        onChange={(event) => setMobile(event.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+91"
                        required
                      />
                    </label>
                    <label className="mw-info-field">
                      <span>Email (optional)</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <label className="mw-info-field">
                      <span>Role</span>
                      <select value={role} onChange={(event) => setRole(event.target.value)}>
                        {positions.map((position) => (
                          <option key={position.role} value={position.role}>
                            {position.role}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <label className="mw-info-field">
                      <span>Experience</span>
                      <select
                        value={experience}
                        onChange={(event) => setExperience(event.target.value)}
                      >
                        <option>Fresher</option>
                        <option>0-2 years</option>
                        <option>2-5 years</option>
                        <option>5+ years</option>
                      </select>
                    </label>
                    <label className="mw-info-field">
                      <span>Resume link (optional)</span>
                      <input
                        value={resume}
                        onChange={(event) => setResume(event.target.value)}
                        placeholder="Google Drive or LinkedIn URL"
                      />
                    </label>
                  </div>
                  <label className="mw-info-field">
                    <span>Why this role?</span>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="A short note about your experience and what you want to work on."
                    />
                  </label>

                  {error ? (
                    <p className="mw-apply-error" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <div className="mw-apply-actions">
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="mw-info-button"
                    >
                      {status === "sending" ? "Sending…" : "Send application"}
                      <ArrowRight size={15} />
                    </button>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="mw-apply-mail">
                      <Mail size={14} /> Email us instead
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
