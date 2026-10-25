import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, MessageCircle, Phone, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import {
  BUY_CATEGORY_LIST,
  BUY_YEAR_MAX,
  BUY_YEAR_MIN,
  brandTilesFor,
  catalogModelsFor,
  citiesInCategory,
  fuelOptionsFor,
  getBuyCategory,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { LOCATIONS } from "@/lib/cars-data";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Sell Your Vehicle — Car, Bike, Truck & Tractor | Motor Wallah";
const DESCRIPTION =
  "Pick your vehicle category, share brand, model, year, fuel, price, location and photos, and submit your listing to the Motor Wallah sell team.";

export const Route = createFileRoute("/sell-your-car")({
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

/**
 * Dynamic per-category configuration — every one of the 8 vehicle categories
 * declares its own transmission options, so nothing on this page is hardcoded
 * for cars. TypeScript fails the build if a category is ever missing here.
 */
const TRANSMISSION_OPTIONS: Record<BuyCategoryId, readonly string[]> = {
  cars: ["Manual", "Automatic"],
  bikes: ["Manual", "Automatic"],
  "three-wheelers": ["Manual", "Automatic"],
  scv: ["Manual", "Automatic"],
  trucks: ["Manual", "Automatic"],
  buses: ["Manual", "Automatic"],
  tractors: ["Manual"],
  taxi: ["Manual", "Automatic"],
};

const STEPS = ["Choose Category", "Vehicle Details", "Submitted"] as const;

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

type Step = "category" | "form" | "done";

type Submission = {
  categoryLabel: string;
  vehicle: string;
  name: string;
  mobile: string;
  expectedPrice: string;
};

function Page() {
  const [step, setStep] = useState<Step>("category");
  const [categoryId, setCategoryId] = useState<BuyCategoryId | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [fuel, setFuel] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const category = categoryId ? getBuyCategory(categoryId) : null;
  const stepIndex = step === "category" ? 0 : step === "form" ? 1 : 2;

  /* Derived, always-valid selections — the Brand -> Model -> Fuel chain can
     never hold a value that does not belong to the chosen category. */
  const brands = category ? brandTilesFor(category.id) : [];
  const safeBrand = brands.some((b) => b.brand === brand) ? brand : "";
  const models = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const safeModel = models.includes(model) ? model : "";
  const fuels = category
    ? fuelOptionsFor(category.id, safeBrand || undefined, safeModel || undefined)
    : [];
  const safeFuel = fuels.includes(fuel) ? fuel : "";
  const locations = category
    ? (() => {
        const cities = citiesInCategory(category.id);
        return cities.length ? cities : [...LOCATIONS];
      })()
    : [];

  const scrollTo = (id: string) =>
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  const pickCategory = (id: BuyCategoryId) => {
    setCategoryId(id);
    setBrand("");
    setModel("");
    setFuel("");
    setPhotos([]);
    setError(null);
    setStep("form");
    scrollTo("sell-form");
  };

  const backToCategories = () => {
    setCategoryId(null);
    setBrand("");
    setModel("");
    setFuel("");
    setPhotos([]);
    setError(null);
    setStep("category");
    scrollTo("sell-categories");
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
    const activeCategory = categoryId ? getBuyCategory(categoryId) : null;
    if (!activeCategory) return;

    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim().slice(0, 200);
    const values = {
      brand: value("brand"),
      model: value("model"),
      year: value("year"),
      fuel: value("fuel"),
      transmission: value("transmission"),
      kilometres: value("kilometres"),
      expectedPrice: value("expectedPrice"),
      location: value("location"),
      name: value("name"),
      mobile: value("mobile"),
    };

    const missing = Object.entries(values).filter(([, v]) => !v);
    if (missing.length) {
      setError("Please fill in every required field before submitting.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(values.mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);

    // Persist the submission through the project's lead capture — the local
    // lead queue first, then the CRM endpoint when VITE_LEAD_ENDPOINT is set.
    await submitLead({
      type: "sell_vehicle",
      source: "sell-your-car",
      vehicleName: `${values.year} ${values.brand} ${values.model}`.trim(),
      location: values.location,
      name: values.name,
      mobile: values.mobile,
      fields: { category: activeCategory.label, ...values },
      photos,
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      vehicle: `${values.brand} ${values.model}`.trim(),
      name: values.name,
      mobile: values.mobile,
      expectedPrice: values.expectedPrice,
    });
    setStep("done");
    scrollTo("sell-done");
  };

  const restart = () => {
    setStep("category");
    setCategoryId(null);
    setBrand("");
    setModel("");
    setFuel("");
    setPhotos([]);
    setError(null);
    setSubmission(null);
    scrollTo("sell-categories");
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to sell my vehicle.");

  return (
    <div id="top" className="mw-sell min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Sell · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Sell Your Vehicle <em>at the Right Price</em>
            </h1>
            <p className="mw-sell-hero-text">
              Choose what you are selling — the form adapts to your category with the right
              brands, models and fields. Every vehicle type, one simple flow.
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
            </div>
            <div className="mw-sell-steps" aria-label="Sell flow steps">
              {STEPS.map((label, i) => (
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

        {/* ---------------- Step A: category bento grid ---------------- */}
        {step === "category" && (
          <section
            id="sell-categories"
            className="mw-sell-section"
            aria-labelledby="sell-cats-title"
          >
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="sell-cats-title" className="mw-sell-title">
                What are you <span>selling?</span>
              </h2>
              <p className="mw-sell-text">
                Explore 8 categories — each card opens its own form with the correct brands,
                models and fields for that vehicle type.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Sell ${item.singular}`}
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

        {/* ---------------- Step B: dynamic glass form ---------------- */}
        {step === "form" && category && (
          <section id="sell-form" className="mw-sell-form-section" aria-labelledby="sell-form-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Selling <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <h2 id="sell-form-title" className="mw-sell-form-title">
                  Tell us about your <span>{category.singular}</span>
                </h2>
                <p className="mw-sell-form-sub">
                  Brands and models come straight from our {category.label} catalogue — active
                  and discontinued models included. Fields marked * are required.
                </p>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Brand *</span>
                    <select
                      name="brand"
                      required
                      className="mw-sell-input"
                      value={safeBrand}
                      onChange={(event) => {
                        setBrand(event.target.value);
                        setModel("");
                      }}
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
                    <select
                      name="model"
                      required
                      className="mw-sell-input"
                      value={safeModel}
                      disabled={!safeBrand}
                      onChange={(event) => setModel(event.target.value)}
                    >
                      <option value="">{safeBrand ? "Select model" : "Select a brand first"}</option>
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">
                      Year <small>({BUY_YEAR_MIN}–{BUY_YEAR_MAX})</small> *
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
                    <span className="mw-sell-field-label">Fuel *</span>
                    <select
                      name="fuel"
                      required
                      className="mw-sell-input"
                      value={safeFuel}
                      onChange={(event) => setFuel(event.target.value)}
                    >
                      <option value="">Select fuel</option>
                      {fuels.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Transmission *</span>
                    <select name="transmission" required defaultValue="" className="mw-sell-input">
                      <option value="">Select transmission</option>
                      {TRANSMISSION_OPTIONS[category.id].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Kilometres Driven *</span>
                    <input
                      className="mw-sell-input"
                      type="number"
                      name="kilometres"
                      min={0}
                      max={2000000}
                      required
                      inputMode="numeric"
                      placeholder="e.g. 18500"
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Expected Price (₹) *</span>
                    <input
                      className="mw-sell-input"
                      type="number"
                      name="expectedPrice"
                      min={1}
                      required
                      inputMode="numeric"
                      placeholder="e.g. 650000"
                    />
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Location *</span>
                    <select name="location" required defaultValue="" className="mw-sell-input">
                      <option value="">Select location</option>
                      {locations.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mw-sell-photos">
                    <span className="mw-sell-field-label">
                      Photo Upload <small>— multiple images, up to 8 MB each</small>
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
                          : "No photos yet — clear photos help your listing sell faster."}
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

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Seller Name *</span>
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

                {error && (
                  <p className="mw-sell-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="mw-sell-form-foot">
                  <button type="submit" className="mw-sell-submit">
                    Submit Listing
                  </button>
                  <p className="mw-sell-form-note">
                    Your submission is saved to Motor Wallah's lead queue so the sell team
                    can follow up — connect your CRM endpoint (VITE_LEAD_ENDPOINT) and it is
                    also delivered there automatically.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step C: success ---------------- */}
        {step === "done" && category && submission && (
          <section id="sell-done" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2 className="mw-sell-done-icon" size={44} strokeWidth={1.6} aria-hidden="true" />
              <h2 className="mw-sell-done-title">Listing Submitted Successfully</h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your {submission.categoryLabel} details are saved
                with the Motor Wallah sell team. Our team will contact you on{" "}
                {submission.mobile} to verify the vehicle and share the next steps.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.vehicle}</span>
                <span>₹{Number(submission.expectedPrice).toLocaleString("en-IN")}</span>
              </div>
              <p className="mw-sell-done-note">
                Saved to this project's lead queue — when your CRM endpoint
                (VITE_LEAD_ENDPOINT) is connected, every submission is delivered to your team
                automatically. Want a faster reply now? Use WhatsApp or call us directly.
              </p>
              <div className="mw-sell-done-actions">
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Sell Another Vehicle
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
