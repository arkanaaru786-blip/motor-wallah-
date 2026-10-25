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
  citiesInCategory,
  getBuyCategory,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { LOCATIONS } from "@/lib/cars-data";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Scrap Your Vehicle — Car, Bike & Truck Scrap Pickup | Motor Wallah";
const DESCRIPTION =
  "Tell us about the vehicle you want to scrap — share its brand, model, year, location and photos, and the Motor Wallah team will contact you for the scrap evaluation.";

export const Route = createFileRoute("/scrap")({
  validateSearch: (search: Record<string, unknown>): ScrapSearch => {
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

type ScrapSearch = {
  /** URL-driven steps: /scrap = category grid, ?view=form = form, ?view=done = success. */
  view?: "form" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

type Submission = {
  categoryLabel: string;
  vehicle: string;
  year: string;
  location: string;
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
      navigate({ to: "/scrap", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, submission, navigate]);

  const brands = category ? brandTilesFor(category.id) : [];
  const safeBrand = brands.some((b) => b.brand === brand) ? brand : "";
  const modelSuggestions = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const locations = category
    ? (() => {
        const cities = citiesInCategory(category.id);
        return cities.length ? cities : [...LOCATIONS];
      })()
    : [];

  const resetFlowState = () => {
    setBrand("");
    setPhotos([]);
    setError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetFlowState();
    pendingScroll.current = "scrap-form";
    navigate({ to: "/scrap", search: { view: "form", cat: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "scrap-categories";
    navigate({ to: "/scrap", search: {} });
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
    const value = (key: string) => String(data.get(key) ?? "").trim().slice(0, 200);
    const model = value("model");
    const year = value("year");
    const location = value("location");
    const name = value("name");
    const mobile = value("mobile");

    if (!safeBrand || !model || !year || !location || !name) {
      setError("Please fill in every required field before submitting.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);

    // Lead-generation only — no valuation, no price, just the scrap enquiry.
    await submitLead({
      type: "scrap_vehicle",
      source: "scrap",
      name,
      mobile,
      location,
      fields: {
        category: activeCategory.label,
        brand: safeBrand,
        model,
        year,
        location,
        name,
        mobile,
      },
      photos,
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      vehicle: `${year} ${safeBrand} ${model}`.trim(),
      year,
      location,
      name,
      mobile,
    });
    pendingScroll.current = "scrap-done";
    navigate({ to: "/scrap", search: { view: "done", cat: activeCategory.id } });
  };

  const restart = () => {
    resetFlowState();
    setSubmission(null);
    pendingScroll.current = "scrap-categories";
    navigate({ to: "/scrap", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to scrap a vehicle.");

  return (
    <div id="top" className="mw-sell mw-scr min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Scrap · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Scrap Your Vehicle <em>Easy Handover</em>
            </h1>
            <p className="mw-sell-hero-text">
              Tell us about the vehicle you want to scrap — share its details and photos, and our
              team contacts you shortly to arrange the scrap evaluation and pickup.
            </p>
            <div className="mw-sell-hero-actions">
              <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Scrap flow steps">
              {["Choose Category", "Vehicle Details", "Submitted"].map((label, i) => (
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
          <section id="scrap-categories" className="mw-sell-section" aria-labelledby="scrap-cats-title">
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="scrap-cats-title" className="mw-sell-title">
                What are you <span>scrapping?</span>
              </h2>
              <p className="mw-sell-text">
                Pick the category of the vehicle you want to scrap — the form opens with the right
                brands and models for it.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Scrap ${item.singular}`}
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

        {/* ---------------- Step 2: the scrap lead form ---------------- */}
        {step === "form" && category && (
          <section id="scrap-form" className="mw-sell-form-section" aria-labelledby="scrap-form-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Scrapping <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <h2 id="scrap-form-title" className="mw-sell-form-title">
                  Scrap <span>{category.singular}</span> Details
                </h2>
                <p className="mw-sell-form-sub">
                  Share the vehicle's condition details and our team takes it from there. Fields
                  marked * are required.
                </p>

                <div className="mw-sell-fields">
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
                      list="scrap-models"
                      placeholder={safeBrand ? `e.g. ${modelSuggestions[0] ?? "Model"}` : "Select a brand first"}
                      disabled={!safeBrand}
                    />
                    <datalist id="scrap-models">
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
                      Photo Upload <small>— current condition of the vehicle</small>
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
                          : "No photos yet — photos help our team assess the condition."}
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

                <div className="mw-sell-fields">
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Name *</span>
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
                    Submit Scrap Request
                  </button>
                  <p className="mw-sell-form-note">
                    Your scrap request — vehicle details, location, photos and contact — is saved
                    to Motor Wallah's lead queue so the team can call you back. Connect your CRM
                    endpoint (VITE_LEAD_ENDPOINT) and it is also delivered there automatically.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step 3: success ---------------- */}
        {step === "done" && category && submission && (
          <section id="scrap-done" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">
                Request Received. Our team will contact you shortly for scrap evaluation.
              </h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your scrap request for {submission.vehicle} in{" "}
                {submission.location} is saved with the Motor Wallah team. We will contact you on{" "}
                {submission.mobile} to arrange the evaluation and pickup.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.vehicle}</span>
                <span>{submission.location}</span>
              </div>
              <p className="mw-sell-done-note">
                Saved to this project's lead queue — when your CRM endpoint
                (VITE_LEAD_ENDPOINT) is connected, every submission is delivered to your team
                automatically. Want a faster reply now? Use WhatsApp or call us directly.
              </p>
              <div className="mw-sell-done-actions">
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Scrap Another Vehicle
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
