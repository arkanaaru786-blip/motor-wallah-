import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Hammer,
  ImagePlus,
  MessageCircle,
  Paintbrush,
  Phone,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
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
import {
  createWorkshopEnquiry,
  getWorkshopDepartment,
  isWorkshopDepartment,
  WORKSHOP_DEPARTMENTS,
  type WorkshopDepartmentId,
} from "@/lib/workshop-enquiries";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";
import { clearFormStart, evaluateBotSignals, markFormStart } from "@/lib/analytics";
import { FormShield, useRecaptchaToken } from "@/components/site/FormShield";

const TITLE = "Book a Vehicle Service — Car, Bike & Truck Service | Motor Wallah";
const DESCRIPTION =
  "Pick your vehicle category, choose the service it needs, share vehicle details, pickup location and a preferred slot — the Motor Wallah team contacts you to confirm the booking.";

export const Route = createFileRoute("/services")({
  validateSearch: (search: Record<string, unknown>): ServiceSearch => {
    const view = search["view"];
    const cat = search["cat"];
    const dept = search["dept"];
    return {
      view: view === "departments" || view === "form" || view === "done" ? view : undefined,
      cat: isCategoryId(cat) ? cat : undefined,
      dept: isWorkshopDepartment(dept) ? dept : undefined,
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
  /** /services = category grid → department grid → form → success. */
  view?: "departments" | "form" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
  dept?: WorkshopDepartmentId | undefined;
};

const DEPARTMENT_ICON = {
  denting: Hammer,
  painting: Paintbrush,
  mechanical: Wrench,
  electrical: Zap,
  detailing: Sparkles,
  "car-wash": Droplets,
} as const;

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
  departmentLabel: string;
  serviceType: string;
  vehicle: string;
  vehicleNumber: string;
  slot: string;
  name: string;
  mobile: string;
  trackingId: string;
  enquiryId: string;
};

function Page() {
  const navigate = useNavigate();
  const { view, cat, dept } = Route.useSearch();
  const { containerRef: recaptchaRef, getToken } = useRecaptchaToken();

  const [brand, setBrand] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pendingScroll = useRef<string | null>(null);

  const category = getBuyCategory(cat) ?? null;
  const department = getWorkshopDepartment(dept);
  const step: "category" | "departments" | "form" | "done" =
    view === "departments" && category
      ? "departments"
      : view === "form" && category && department
        ? "form"
        : view === "done" && category && submission
          ? "done"
          : "category";
  const stepIndex = step === "category" ? 0 : step === "departments" ? 1 : step === "form" ? 2 : 3;

  // Deferred scroll: runs only after the step change has actually rendered.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Defensive fallback for stale step URLs — returns to the category grid.
  useEffect(() => {
    const invalid =
      (view === "departments" && !category) ||
      (view === "form" && (!category || !department)) ||
      (view === "done" && !submission);
    if (!invalid) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/services", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, department, submission, navigate]);

  useEffect(() => {
    if (step === "form" && category && department) {
      markFormStart("services_form");
    }
  }, [step, category, department]);

  const brands = category ? brandTilesFor(category.id) : [];
  const safeBrand = brands.some((b) => b.brand === brand) ? brand : "";
  const modelSuggestions = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const fuels = category ? fuelOptionsFor(category.id, safeBrand || undefined, undefined) : [];
  const serviceTypes = category ? SERVICE_TYPES[category.id] : [];

  const resetFlowState = () => {
    setBrand("");
    setPhotos([]);
    setError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetFlowState();
    pendingScroll.current = "service-departments";
    navigate({ to: "/services", search: { view: "departments", cat: id } });
  };

  const pickDepartment = (id: WorkshopDepartmentId) => {
    if (!category) return;
    pendingScroll.current = "service-form";
    navigate({ to: "/services", search: { view: "form", cat: category.id, dept: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "service-categories";
    navigate({ to: "/services", search: {} });
  };

  const backToDepartments = () => {
    setError(null);
    if (!category) return;
    pendingScroll.current = "service-departments";
    navigate({ to: "/services", search: { view: "departments", cat: category.id } });
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
    const value = (key: string) =>
      String(data.get(key) ?? "")
        .trim()
        .slice(0, 500);
    if (!department) {
      setError("Choose a workshop department before submitting.");
      return;
    }
    const serviceType = value("serviceType");
    const vehicleNumber = value("vehicleNumber").toUpperCase();
    const model = value("model");
    const year = value("year");
    const fuel = value("fuel");
    const location = value("location");
    const date = value("date");
    const time = value("time");
    const name = value("name");
    const mobile = value("mobile");
    const description = value("description");

    if (
      !serviceType ||
      !vehicleNumber ||
      !safeBrand ||
      !model ||
      !year ||
      !fuel ||
      !location ||
      !date ||
      !time ||
      !name
    ) {
      setError("Please fill in every required field before submitting.");
      return;
    }
    if (!/^[A-Z0-9 -]{6,15}$/.test(vehicleNumber)) {
      setError("Enter a valid vehicle number, for example MH12AB4521.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);

    const vehicle = `${year} ${safeBrand} ${model}`.trim();
    // The workshop enquiry is the durable record the partner portal works on.
    // It starts unclaimed so the first workshop that accepts it owns it.
    const created = createWorkshopEnquiry({
      customerName: name,
      mobile,
      category: activeCategory.label,
      department: department.id,
      serviceType,
      vehicleNumber,
      vehicle,
      brand: safeBrand,
      model,
      year,
      fuel,
      issue: description,
      location,
      preferredDate: date,
      preferredTime: time,
      photoCount: photos.length,
    });
    if (!created.ok) {
      setError(created.error);
      return;
    }

    // The same intent is written to the structured Supabase lead log so the
    // CRM, email alert and dashboard keep one shared reference.
    const botCheck = evaluateBotSignals("services_form", getToken());
    await submitLead({
      type: "workshop_enquiry",
      source: "services",
      name,
      mobile,
      location,
      isSuspicious: botCheck.suspicious,
      suspicionReason: botCheck.reason ?? undefined,
      submitDurationMs: botCheck.durationMs,
      recaptchaTokenPresent: Boolean(getToken()),
      fields: {
        category: activeCategory.label,
        department: department.label,
        departmentId: department.id,
        serviceType,
        vehicleNumber,
        brand: safeBrand,
        model,
        year,
        fuel,
        location,
        date,
        time,
        description,
        trackingId: created.enquiry.trackingId,
        enquiryId: created.enquiry.id,
        name,
        mobile,
      },
      photos,
    });
    clearFormStart("services_form");

    setSubmission({
      categoryLabel: activeCategory.label,
      departmentLabel: department.label,
      serviceType,
      vehicle,
      vehicleNumber,
      slot: `${date} · ${time}`,
      name,
      mobile,
      trackingId: created.enquiry.trackingId,
      enquiryId: created.enquiry.id,
    });
    pendingScroll.current = "service-done";
    navigate({
      to: "/services",
      search: { view: "done", cat: activeCategory.id, dept: department.id },
    });
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
              Pick your vehicle category, choose exactly the service it needs, share the details and
              a preferred slot — our team contacts you shortly to confirm the booking.
            </p>
            <div className="mw-sell-hero-actions">
              <a
                className="mw-sell-ghost-btn"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
              <Link className="mw-sell-ghost-btn" to="/track">
                Track Service
              </Link>
            </div>
            <div className="mw-sell-steps" aria-label="Service flow steps">
              {["Choose Category", "Workshop Department", "Service Details", "Submitted"].map(
                (label, i) => (
                  <span
                    key={label}
                    className={`mw-sell-step${i === stepIndex ? " mw-sell-step--active" : ""}`}
                  >
                    {i + 1}. {label}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ---------------- Step 1: category grid ---------------- */}
        {step === "category" && (
          <section
            id="service-categories"
            className="mw-sell-section"
            aria-labelledby="service-cats-title"
          >
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

        {/* ---------------- Step 2: workshop department grid ---------------- */}
        {step === "departments" && category && (
          <section
            id="service-departments"
            className="mw-sell-section mw-srv-depts"
            aria-labelledby="service-depts-title"
          >
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

              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose workshop department
              </p>
              <h2 id="service-depts-title" className="mw-sell-title">
                What kind of <span>work?</span>
              </h2>
              <p className="mw-sell-text">
                Pick the department closest to the job. Your enquiry goes to the workshop desk with
                this choice, so the right team can accept it and plan the visit.
              </p>

              <div className="mw-srv-dept-grid">
                {WORKSHOP_DEPARTMENTS.map((item) => {
                  const Icon = DEPARTMENT_ICON[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="mw-srv-dept"
                      data-department={item.id}
                      onClick={() => pickDepartment(item.id)}
                      aria-label={`${item.label} workshop department`}
                    >
                      <span className="mw-srv-dept-icon" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <span className="mw-srv-dept-body">
                        <strong>{item.label}</strong>
                        <span>{item.blurb}</span>
                        <small>{item.examples}</small>
                      </span>
                      <span className="mw-srv-dept-foot">
                        From ₹{item.from.toLocaleString("en-IN")}
                        <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 3: dynamic glass booking form ---------------- */}
        {step === "form" && category && department && (
          <section
            id="service-form"
            className="mw-sell-form-section"
            aria-labelledby="service-form-title"
          >
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToDepartments}>
                  <ArrowLeft size={14} /> Change department
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    {department.label} <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <h2 id="service-form-title" className="mw-sell-form-title">
                  Book <span>{department.label}</span> Service
                </h2>
                <p className="mw-sell-form-sub">
                  {department.blurb} — options below are scoped to {category.label}. Fields marked *
                  are required.
                </p>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">Vehicle Number *</span>
                    <input
                      className="mw-sell-input mw-srv-plate-input"
                      type="text"
                      name="vehicleNumber"
                      required
                      maxLength={15}
                      placeholder="MH12AB4521"
                      data-testid="service-vehicle-number"
                    />
                  </label>

                  {/* CRITICAL — service type changes with the picked category */}
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">Service Type *</span>
                    <select
                      name="serviceType"
                      required
                      defaultValue=""
                      className="mw-sell-input"
                      data-testid="service-type"
                    >
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
                      placeholder={
                        safeBrand
                          ? `e.g. ${modelSuggestions[0] ?? "Model"}`
                          : "Select a brand first"
                      }
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
                      Year{" "}
                      <small>
                        ({BUY_YEAR_MIN}–{BUY_YEAR_MAX})
                      </small>{" "}
                      *
                    </span>
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
                      Location <small>— pickup address or city</small> *
                    </span>
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
                    <input className="mw-sell-input" type="date" name="date" required min={today} />
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
                              onClick={() =>
                                setPhotos((prev) => prev.filter((x) => x.id !== photo.id))
                              }
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

                <FormShield containerRef={recaptchaRef} ready={true} />

                <div className="mw-sell-form-foot">
                  <button type="submit" className="mw-sell-submit">
                    Send Workshop Enquiry
                  </button>
                  <p className="mw-sell-form-note">
                    Your enquiry — {department.label}, vehicle, issue, pickup location and preferred
                    slot — is sent to the workshop desk. Protected with reCAPTCHA and bot checks.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step 4: success ---------------- */}
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
                Workshop Enquiry Received — a partner will accept it shortly.
              </h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your {submission.departmentLabel} enquiry for{" "}
                {submission.vehicle} ({submission.vehicleNumber}) is now in the workshop portal. The
                workshop will accept it and either arrange a pickup or ask you to visit. Track this
                page for the final estimate.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.departmentLabel}</span>
                <span>{submission.serviceType}</span>
                <span>{submission.vehicle}</span>
                <span>{submission.vehicleNumber}</span>
                <span>{submission.slot}</span>
              </div>
              <p className="mw-srv-enquiry-ref" data-testid="enquiry-reference">
                Workshop enquiry <strong>{submission.enquiryId}</strong>
              </p>

              {/* Live tracking — unique ID for this booking. */}
              <div className="mw-srv-trackid" data-testid="tracking-id">
                <span className="mw-srv-trackid-label">Your Tracking ID</span>
                <strong className="mw-srv-trackid-value">{submission.trackingId}</strong>
                <p className="mw-srv-trackid-note">Save this ID to track your service.</p>
              </div>

              <p className="mw-sell-done-note">
                Your enquiry is stored in the Supabase-backed workshop record and shared with the
                workshop desk. The checklist and final estimate appear here on Track Service once
                the vehicle is received.
              </p>
              <div className="mw-sell-done-actions">
                <Link className="mw-sell-submit" to="/track" search={{ id: submission.trackingId }}>
                  Track My Service
                </Link>
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Book Another Service
                </button>
                <a
                  className="mw-sell-ghost-btn"
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
