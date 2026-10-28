import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Battery,
  CheckCircle2,
  Cog,
  ImagePlus,
  Lightbulb,
  MessageCircle,
  Phone,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import {
  BUY_CATEGORY_LIST,
  BUY_YEAR_MAX,
  BUY_YEAR_MIN,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Auto Parts & Accessories — New & Used | Motor Wallah";
const DESCRIPTION =
  "Pick a parts category, tell us your vehicle and the part you need — Motor Wallah sources genuine, OEM-fit and condition-graded used parts and contacts you with availability and pricing.";

export const Route = createFileRoute("/accessories")({
  validateSearch: (search: Record<string, unknown>): PartsSearch => {
    const view = search["view"];
    const cat = search["cat"];
    return {
      view: view === "form" || view === "done" ? view : undefined,
      cat: isPartsCategoryId(cat) ? cat : undefined,
    };
  },
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

type PartsSearch = {
  /** URL-driven steps: /accessories = category grid, ?view=form = form, ?view=done = success. */
  view?: "form" | "done" | undefined;
  cat?: PartsCategoryId | undefined;
};

/* -------------------------------------------------------------------------- */
/* CRITICAL: the "Part Needed" options are scoped to the picked parts category,*/
/* exactly like the Service page's category-specific Service Type dropdown.    */
/* -------------------------------------------------------------------------- */
const PART_TYPES: Record<string, readonly string[]> = {
  new: [
    "Brake Components",
    "Batteries",
    "Tyres & Wheels",
    "Filters & Service Kits",
    "Lights & Electrical",
    "Body & Bumpers",
  ],
  used: [
    "Brake Components",
    "Batteries",
    "Tyres & Wheels",
    "Filters & Service Kits",
    "Lights & Electrical",
    "Body & Bumpers",
  ],
  accessories: [
    "Seat Covers & Cushions",
    "Floor Mats & Liners",
    "Body Covers & Sunshades",
    "Mobile Holders & Chargers",
    "Interior Styling & LED Strips",
    "Bike Accessories & Helmets",
  ],
};

type PartsCategoryId = "new" | "used" | "accessories";

const isPartsCategoryId = (value: unknown): value is PartsCategoryId =>
  typeof value === "string" &&
  (value === "new" || value === "used" || value === "accessories");

const PART_CATEGORIES: {
  id: PartsCategoryId;
  label: string;
  blurb: string;
  icon: typeof Cog;
}[] = [
  {
    id: "new",
    label: "New Auto Parts",
    blurb: "Genuine & OEM-fit parts for every vehicle category",
    icon: Cog,
  },
  {
    id: "used",
    label: "Second-Hand Parts",
    blurb: "Condition-graded used parts & assemblies",
    icon: Wrench,
  },
  {
    id: "accessories",
    label: "Car & Bike Accessories",
    blurb: "Interior, exterior & lifestyle add-ons",
    icon: Sparkles,
  },
];

const QUANTITY_HINTS: Record<PartsCategoryId, string> = {
  new: "e.g. 2 (pair of brake pads)",
  used: "e.g. 1 (single headlight assembly)",
  accessories: "e.g. 1 set",
};

const DESCRIPTION_HINTS: Record<PartsCategoryId, string> = {
  new: "e.g. front brake pads for 2019 Nexon, genuine/OEM part number if known…",
  used: "e.g. right-side ORVM in working condition, any colour acceptable…",
  accessories: "e.g. black leatherette seat covers for Swift, weather-proof floor mats…",
};

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

type Submission = {
  categoryLabel: string;
  partType: string;
  vehicle: string;
  name: string;
  mobile: string;
};

function Page() {
  const navigate = useNavigate();
  const { view, cat } = Route.useSearch();

  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pendingScroll = useRef<string | null>(null);

  const category = PART_CATEGORIES.find((c) => c.id === cat) ?? null;
  const step: "category" | "form" | "done" =
    view === "form" && category ? "form" : view === "done" && category ? "done" : "category";
  const stepIndex = step === "category" ? 0 : step === "form" ? 1 : 2;

  // Deferred scroll: runs only after the step change has actually rendered.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Defensive fallback for stale form/done URLs — returns to the category grid.
  useEffect(() => {
    const invalid = (view === "form" && !category) || (view === "done" && !submission);
    if (!invalid) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/accessories", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, submission, navigate]);

  const partTypes = category ? PART_TYPES[category.id] ?? [] : [];

  const resetFlowState = () => {
    setPhotos([]);
    setError(null);
  };

  const pickCategory = (id: PartsCategoryId) => {
    resetFlowState();
    pendingScroll.current = "parts-form";
    navigate({ to: "/accessories", search: { view: "form", cat: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "parts-categories";
    navigate({ to: "/accessories", search: {} });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: UploadedFile[] = [];
    for (const file of Array.from(files).slice(0, 20)) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files can be uploaded as part photos.");
        continue;
      }
      try {
        added.push(await toUploadedFile(file, "Part photo"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added].slice(0, 20));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const activeCategory = category;
    if (!activeCategory) return;

    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim().slice(0, 500);
    const partType = value("partType");
    const vehicleType = value("vehicleType");
    const brand = value("brand");
    const model = value("model");
    const year = value("year");
    const quantity = value("quantity");
    const delivery = value("delivery");
    const location = value("location");
    const name = value("name");
    const mobile = value("mobile");
    const description = value("description");

    if (!partType || !vehicleType || !brand || !model || !year || !quantity || !delivery || !location || !name || !mobile) {
      setError("Please fill all required fields (marked *).");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setError(null);
    const vehicle = `${year} ${brand} ${model}`.trim();

    // Saved to the project's lead queue (and CRM endpoint when configured).
    await submitLead({
      type: "parts_enquiry",
      source: `accessories_${activeCategory.id}`,
      vehicleName: `${partType} for ${vehicle}`,
      name,
      mobile,
      fields: {
        category: activeCategory.label,
        partType,
        vehicleType,
        brand,
        model,
        year,
        quantity,
        delivery,
        location,
        description,
        photoCount: String(photos.length),
      },
      photos: photos.length ? photos : undefined,
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      partType,
      vehicle,
      name,
      mobile,
    });
    navigate({ to: "/accessories", search: { view: "done", cat: activeCategory.id } });
  };

  const restart = () => {
    resetFlowState();
    setSubmission(null);
    pendingScroll.current = "parts-categories";
    navigate({ to: "/accessories", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I need help finding a vehicle part.");

  return (
    <div id="top" className="mw-sell mw-parts min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Auto Parts · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Parts & <em>Accessories</em>
            </h1>
            <p className="mw-sell-hero-text">
              Genuine new parts, condition-graded used parts and accessories — pick a category,
              tell us your vehicle and the part you need, and our team replies with
              availability and pricing.
            </p>
            <div className="mw-sell-hero-actions">
              <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Parts flow steps">
              {["Choose Category", "Part Details", "Submitted"].map((label, i) => (
                <span
                  key={label}
                  className={`mw-sell-step${i === stepIndex ? " mw-sell-step--active" : ""}`}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Step 1: category grid (FIRST — no direct form) ---------------- */}
        {step === "category" && (
          <section id="parts-categories" className="mw-sell-section" aria-labelledby="parts-cats-title">
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose what you need
              </p>
              <h2 id="parts-cats-title" className="mw-sell-title">
                What are you <span>looking for?</span>
              </h2>
              <p className="mw-sell-text">
                Each category opens its own enquiry form with the right part options for your
                vehicle.
              </p>

              <div className="mw-sell-grid mw-parts-grid">
                {PART_CATEGORIES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-category={item.id}
                      className="mw-sell-cat"
                      onClick={() => pickCategory(item.id)}
                      aria-label={`Request ${item.label}`}
                    >
                      <span className="mw-sell-cat-media mw-parts-media">
                        <Icon size={40} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="mw-sell-cat-body">
                        <span className="mw-sell-cat-name">{item.label}</span>
                        <span className="mw-sell-cat-blurb">{item.blurb}</span>
                      </span>
                      <span className="mw-sell-cat-arrow" aria-hidden="true">
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mw-parts-note">
                <Battery size={16} aria-hidden="true" />
                <span>
                  Not sure which part fits your vehicle? Pick any category and mention your car in
                  the form — we confirm fitment before quoting.
                </span>
                <Lightbulb size={16} aria-hidden="true" />
                <span>
                  Looking for service instead?{" "}
                  <Link to="/services" className="mw-parts-note-link">
                    Book a vehicle service
                  </Link>
                  .
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2: dynamic glass parts form ---------------- */}
        {step === "form" && category && (
          <section id="parts-form" className="mw-sell-form-section" aria-labelledby="parts-form-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <Settings2 size={16} aria-hidden="true" />
                  <span>
                    Requesting <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <h2 id="parts-form-title" className="mw-sell-form-title">
                  Request <span>{category.label}</span>
                </h2>
                <p className="mw-sell-form-sub">
                  Part options below are scoped to {category.label}. Fields marked * are
                  required.
                </p>

                <div className="mw-sell-fields">
                  {/* CRITICAL — part options change with the picked category */}
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">Part Needed *</span>
                    <select
                      name="partType"
                      required
                      defaultValue=""
                      className="mw-sell-input"
                      data-testid="part-type"
                    >
                      <option value="">Select part</option>
                      {partTypes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Vehicle Type *</span>
                    <select name="vehicleType" required defaultValue="" className="mw-sell-input">
                      <option value="">Select vehicle type</option>
                      {BUY_CATEGORY_LIST.map((c) => (
                        <option key={c.id} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Brand *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="brand"
                      required
                      maxLength={60}
                      placeholder="e.g. Tata, Maruti, Hero"
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Model *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="model"
                      required
                      maxLength={60}
                      placeholder="e.g. Nexon, Swift, Splendor"
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">
                      Year <small>({BUY_YEAR_MIN}–{BUY_YEAR_MAX})</small> *</span>
                    <select name="year" required defaultValue="" className="mw-sell-input">
                      <option value="">Select year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Quantity *</span>
                    <input
                      className="mw-sell-input"
                      type="number"
                      name="quantity"
                      required
                      min={1}
                      max={99}
                      defaultValue={1}
                      placeholder={QUANTITY_HINTS[category.id]}
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Delivery Preference *</span>
                    <select name="delivery" required defaultValue="" className="mw-sell-input">
                      <option value="">Select preference</option>
                      <option value="Doorstep Delivery">Doorstep Delivery</option>
                      <option value="Store Pickup">Store Pickup</option>
                    </select>
                  </label>

                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">
                      Location <small>— city or pickup address</small> *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="location"
                      required
                      maxLength={120}
                      placeholder="City or pickup address"
                    />
                  </label>
                </div>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Customer Name *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="name"
                      required
                      maxLength={80}
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Mobile Number *</span>
                    <input
                      className="mw-sell-input"
                      type="tel"
                      name="mobile"
                      required
                      maxLength={15}
                      pattern="[0-9+ ]{10,15}"
                      placeholder="10-digit mobile"
                    />
                  </label>
                </div>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">
                      Part details <small>— optional</small>
                    </span>
                    <textarea
                      className="mw-sell-input"
                      name="description"
                      rows={3}
                      maxLength={600}
                      placeholder={DESCRIPTION_HINTS[category.id]}
                    />
                  </label>

                  <div className="mw-sell-photos">
                    <span className="mw-sell-field-label">
                      Photo Upload <small>— optional, old part photo helps match</small>
                    </span>
                    <div className="mw-sell-photo-actions">
                      <button
                        type="button"
                        className="mw-sell-photo-add"
                        onClick={() => photoRef.current?.click()}
                      >
                        <ImagePlus size={15} /> Add Photos
                      </button>
                      <span className="mw-sell-photo-hint">
                        {photos.length > 0
                          ? `${photos.length} photo${photos.length === 1 ? "" : "s"} attached`
                          : "No photos yet — a photo of the old part helps us confirm fitment."}
                      </span>
                    </div>
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(event) => {
                        void addPhotos(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    {photos.length > 0 && (
                      <div className="mw-sell-photo-list">
                        {photos.map((photo) => (
                          <figure key={photo.id} className="mw-sell-photo">
                            <img src={photo.dataUrl} alt={photo.label} />
                            <button
                              type="button"
                              className="mw-sell-photo-remove"
                              aria-label={`Remove photo ${photo.name}`}
                              onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== photo.id))}
                            >
                              <Trash2 size={13} />
                            </button>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="mw-sell-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="mw-sell-form-foot">
                  <button type="submit" className="mw-sell-submit">
                    Request Parts
                  </button>
                  <p className="mw-sell-form-sub">
                    Your request — part, vehicle details, delivery preference and contact — is
                    saved to Motor Wallah's lead queue so the team can source it. Connect your CRM
                    endpoint (VITE_LEAD_ENDPOINT) and it is also delivered there automatically.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step 3: success ---------------- */}
        {step === "done" && category && submission && (
          <section id="parts-done" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">
                Parts Request Received! Our team will contact you shortly with availability and
                pricing.
              </h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your request for <strong>{submission.partType}</strong>{" "}
                ({submission.categoryLabel}) for {submission.vehicle} is saved with the Motor
                Wallah team. We will contact you on {submission.mobile}.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.partType}</span>
                <span>{submission.vehicle}</span>
              </div>

              <p className="mw-sell-done-note">
                Saved to this project's lead queue — when your CRM endpoint
                (VITE_LEAD_ENDPOINT) is connected, every submission is delivered to your team
                automatically. Want a faster reply now? Use WhatsApp or call us directly.
              </p>
              <div className="mw-sell-done-actions">
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Request Another Part
                </button>
                <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                  <Phone size={14} /> Call {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
