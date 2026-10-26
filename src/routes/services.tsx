import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  MessageCircle,
  Phone,
  Trash2,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import {
  BUY_CATEGORY_LIST,
  BUY_YEAR_MAX,
  BUY_YEAR_MIN,
  brandTilesFor,
  catalogModelsFor,
  fuelOptionsFor,
  getBuyCategory,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Book a Vehicle Service — Car, Bike & Truck Service | Motor Wallah";
const DESCRIPTION =
  "Pick your vehicle category, choose the service it needs, share vehicle details, pickup location and a preferred slot — the Motor Wallah team contacts you to confirm the booking.";

export const Route = createFileRoute("/services")({
  validateSearch: (search: Record<string, unknown>): ServiceSearch => {
    const view = search["view"];
    const cat = search["cat"];
    return {
      view: view === "form" || view === "done" ? view : undefined,
      cat: isCategoryId(cat) ? cat : undefined,
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

type ServiceSearch = {
  /** URL-driven steps: /services = category grid, ?view=form = form, ?view=done = success. */
  view?: "form" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

/* -------------------------------------------------------------------------- */
/* CRITICAL: Service Type options are category-specific, exactly as specified. */
/* Trucks / SCV / Buses share one commercial-vehicle list. Taxi (commercial    */
/* cars) has no list of its own in the brief, so it uses the Cars list.        */
/* -------------------------------------------------------------------------- */
const CAR_SERVICES = [
  "Periodic/General Service",
  "AC Repair & Gas Refill",
  "Denting & Painting",
  "Engine & Transmission Work",
  "Suspension & Steering",
  "Brakes & Tyres",
  "Electrical & Battery",
  "Detailing & Car Spa",
] as const;

const BIKE_SERVICES = [
  "General Service",
  "Engine Tuning & Overhauling",
  "Clutch & Chain Sprocket",
  "Brakes & Tyres",
  "Electrical & Battery",
  "Denting & Painting",
  "Customization",
] as const;

const THREE_WHEELER_SERVICES = [
  "Motor & Controller Repair (EV)",
  "General Service & Greasing",
  "Suspension & Leaf Spring Work",
  "Brakes & Clutch",
  "Battery Replacement (EV)",
  "Body & Canopy Repair",
] as const;

const COMMERCIAL_SERVICES = [
  "Engine & Turbo Repair",
  "Air Brake System",
  "Suspension & Spring",
  "Gearbox & Differential",
  "Clutch & Pressure Plate",
  "AC & Cabin Cooling",
  "Tyre & Wheel Alignment",
  "Fabrication & Body Repair",
] as const;

const TRACTOR_SERVICES = [
  "Engine Overhauling",
  "Hydraulics Repair",
  "Clutch & Transmission",
  "Steering & Brakes",
  "Electrical & Alternator",
  "Implement Repair",
] as const;

const SERVICE_TYPES: Record<BuyCategoryId, readonly string[]> = {
  cars: CAR_SERVICES,
  bikes: BIKE_SERVICES,
  "three-wheelers": THREE_WHEELER_SERVICES,
  scv: COMMERCIAL_SERVICES,
  trucks: COMMERCIAL_SERVICES,
  buses: COMMERCIAL_SERVICES,
  tractors: TRACTOR_SERVICES,
  taxi: CAR_SERVICES,
};

/** Preferred time slots — a dropdown, not a free-text box. */
const TIME_SLOTS = [
  "09:00 AM – 11:00 AM",
  "11:00 AM – 01:00 PM",
  "01:00 PM – 03:00 PM",
  "03:00 PM – 05:00 PM",
  "05:00 PM – 07:00 PM",
];

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

type Submission = {
  categoryLabel: string;
  serviceType: string;
  vehicle: string;
  slot: string;
  name: string;
  mobile: string;
};

function Page() {
  const navigate = useNavigate();
  const { view, cat } = Route.useSearch();

  const [brand, setBrand] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pendingScroll = useRef<string | null>(null);

  const category = getBuyCategory(cat) ?? null;
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
      navigate({ to: "/services", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, submission, navigate]);

  const brands = category ? brandTilesFor(category.id) : [];
  const safeBrand = brands.some((b) => b.brand === brand) ? brand : "";
  const modelSuggestions = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const fuels = category
    ? fuelOptionsFor(category.id, safeBrand || undefined, undefined)
    : [];
  const serviceTypes = category ? SERVICE_TYPES[category.id] : [];

  const resetFlowState = () => {
    setBrand("");
    setPhotos([]);
    setError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetFlowState();
    pendingScroll.current = "service-form";
    navigate({ to: "/services", search: { view: "form", cat: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "service-categories";
    navigate({ to: "/services", search: {} });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: UploadedFile[] = [];
    for (const file of Array.from(files).slice(0, 20)) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files can be uploaded as vehicle photos.");
        continue;
      }
      try {
        added.push(await toUploadedFile(file, "Vehicle photo"));
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
    const serviceType = value("serviceType");
    const model = value("model");
    const year = value("year");
    const fuel = value("fuel");
    const location = value("location");
    const date = value("date");
    const time = value("time");
    const name = value("name");
    const mobile = value("mobile");
    const description = value("description");

    if (!serviceType || !safeBrand || !model || !year || !fuel || !location || !date || !time || !name) {
      setError("Please fill in every required field before submitting.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);

    // Persist through the project's lead capture — local lead queue first,
    // CRM endpoint (VITE_LEAD_ENDPOINT) second — so the team receives it.
    await submitLead({
      type: "service_booking",
      source: "services",
      name,
      mobile,
      location,
      fields: {
        category: activeCategory.label,
        serviceType,
        brand: safeBrand,
        model,
        year,
        fuel,
        location,
        date,
        time,
        description,
        name,
        mobile,
      },
      photos,
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      serviceType,
      vehicle: `${year} ${safeBrand} ${model}`.trim(),
      slot: `${date} · ${time}`,
      name,
      mobile,
    });
    pendingScroll.current = "service-done";
    navigate({ to: "/services", search: { view: "done", cat: activeCategory.id } });
  };

  const restart = () => {
    resetFlowState();
    setSubmission(null);
    pendingScroll.current = "service-categories";
    navigate({ to: "/services", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to book a vehicle service.");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div id="top" className="mw-sell mw-srv min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Service · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Book Your Vehicle <em>Service</em>
            </h1>
            <p className="mw-sell-hero-text">
              Pick your vehicle category, choose exactly the service it needs, share the details
              and a preferred slot — our team contacts you shortly to confirm the booking.
            </p>
            <div className="mw-sell-hero-actions">
              <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Service flow steps">
              {["Choose Category", "Service Details", "Submitted"].map((label, i) => (
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

        {/* ---------------- Step 1: category grid ---------------- */}
        {step === "category" && (
          <section id="service-categories" className="mw-sell-section" aria-labelledby="service-cats-title">
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="service-cats-title" className="mw-sell-title">
                What needs <span>servicing?</span>
              </h2>
              <p className="mw-sell-text">
                Every category has its own service menu — pick yours to open the booking form with
                the right services, brands and models.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Service ${item.singular}`}
                  >
                    <span className="mw-sell-cat-media">
                      <img
                        src={item.image}
                        alt={`${item.label} illustrative vehicle photograph`}
                        width={720}
                        height={450}
                        loading="lazy"
                      />
                    </span>
                    <span className="mw-sell-cat-body">
                      <span className="mw-sell-cat-name">{item.label}</span>
                      <span className="mw-sell-cat-blurb">{item.blurb}</span>
                    </span>
                    <span className="mw-sell-cat-arrow" aria-hidden="true">
                      <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2: dynamic glass booking form ---------------- */}
        {step === "form" && category && (
          <section id="service-form" className="mw-sell-form-section" aria-labelledby="service-form-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Servicing <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <h2 id="service-form-title" className="mw-sell-form-title">
                  Book <span>{category.singular}</span> Service
                </h2>
                <p className="mw-sell-form-sub">
                  Service options below are scoped to {category.label}. Fields marked * are
                  required.
                </p>

                <div className="mw-sell-fields">
                  {/* CRITICAL — service type changes with the picked category */}
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">Service Type *</span>
                    <select name="serviceType" required defaultValue="" className="mw-sell-input" data-testid="service-type">
                      <option value="">Select service type</option>
                      {serviceTypes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Brand *</span>
                    <select
                      name="brand"
                      required
                      className="mw-sell-input"
                      value={safeBrand}
                      onChange={(event) => setBrand(event.target.value)}
                    >
                      <option value="">Select brand</option>
                      {brands.map((b) => (
                        <option key={b.brand} value={b.brand}>
                          {b.brand}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Model *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="model"
                      required
                      maxLength={60}
                      list="service-models"
                      placeholder={safeBrand ? `e.g. ${modelSuggestions[0] ?? "Model"}` : "Select a brand first"}
                      disabled={!safeBrand}
                    />
                    <datalist id="service-models">
                      {modelSuggestions.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
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
                    <span className="mw-sell-field-label">Fuel Type *</span>
                    <select name="fuel" required defaultValue="" className="mw-sell-input">
                      <option value="">Select fuel</option>
                      {fuels.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">
                      Location <small>— pickup address or city</small> *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="location"
                      required
                      maxLength={120}
                      placeholder="Pickup address or city"
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Preferred Date *</span>
                    <input
                      className="mw-sell-input"
                      type="date"
                      name="date"
                      required
                      min={today}
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Preferred Time Slot *</span>
                    <select name="time" required defaultValue="" className="mw-sell-input">
                      <option value="">Select time slot</option>
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
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
                      Describe the issue <small>— optional</small>
                    </span>
                    <textarea
                      className="mw-sell-input"
                      name="description"
                      rows={3}
                      maxLength={600}
                      placeholder="e.g. AC not cooling at idle, noise over speed breakers…"
                    />
                  </label>

                  <div className="mw-sell-photos">
                    <span className="mw-sell-field-label">
                      Photo Upload <small>— optional, helps us prepare</small>
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
                          : "No photos yet — photos of the issue help us prepare."}
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
                    Book Service
                  </button>
                  <p className="mw-sell-form-note">
                    Your booking — service type, vehicle details, pickup location, preferred slot
                    and contact — is saved to Motor Wallah's lead queue so the team can confirm
                    it. Connect your CRM endpoint (VITE_LEAD_ENDPOINT) and it is also delivered
                    there automatically.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step 3: success ---------------- */}
        {step === "done" && category && submission && (
          <section id="service-done" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">
                Service Request Received! Our team will contact you shortly to confirm the booking.
              </h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your {submission.serviceType} request for{" "}
                {submission.vehicle} is saved with the Motor Wallah team. We will contact you on{" "}
                {submission.mobile} to confirm the {submission.slot} slot.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.serviceType}</span>
                <span>{submission.vehicle}</span>
                <span>{submission.slot}</span>
              </div>
              <p className="mw-sell-done-note">
                Saved to this project's lead queue — when your CRM endpoint
                (VITE_LEAD_ENDPOINT) is connected, every submission is delivered to your team
                automatically. Want a faster reply now? Use WhatsApp or call us directly.
              </p>
              <div className="mw-sell-done-actions">
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Book Another Service
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
