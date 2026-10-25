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
  buyListingName,
  catalogModelsFor,
  fuelOptionsFor,
  getBuyCategory,
  listingsInCategory,
  rupees,
  type BuyCategoryId,
  type BuyListing,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { toUploadedFile, type UploadedFile } from "@/lib/uploads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Exchange Your Vehicle — Car, Bike, Truck | Motor Wallah";
const DESCRIPTION =
  "Trade your current vehicle against anything from our listings — see the estimated value of your old vehicle and the exact price difference before you submit.";

export const Route = createFileRoute("/exchange")({
  validateSearch: (search: Record<string, unknown>): ExchangeSearch => {
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

type ExchangeSearch = {
  /** URL-driven steps: /exchange = category grid, ?view=form, ?view=done. */
  view?: "form" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

/** Per-category transmission options — every one of the 8 categories covered. */
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

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

/**
 * Dummy exchange valuation — deterministic, based only on the vehicle's age
 * (vs BUY_YEAR_MAX) and kilometres driven, per the brief's example logic.
 */
const EXCHANGE_BASE_VALUE: Record<BuyCategoryId, number> = {
  cars: 700000,
  bikes: 90000,
  "three-wheelers": 180000,
  scv: 400000,
  trucks: 1800000,
  buses: 1500000,
  tractors: 550000,
  taxi: 600000,
};

const estimateExchangeValue = (categoryId: BuyCategoryId, year: number, km: number): number => {
  const base = EXCHANGE_BASE_VALUE[categoryId];
  const age = Math.max(0, BUY_YEAR_MAX - year);
  const ageFactor = Math.max(0.15, 1 - age * 0.07);
  const kmFactor = Math.max(0.5, 1 - (km / 100000) * 0.1);
  return Math.max(15000, Math.round((base * ageFactor * kmFactor) / 1000) * 1000);
};

/** Every vehicle in the existing BUY listings, grouped for the "new vehicle" picker. */
const NEW_LISTINGS = BUY_CATEGORY_LIST.flatMap((c) => listingsInCategory(c.id));
const LISTING_BY_ID = new Map(NEW_LISTINGS.map((l) => [l.id, l]));

type Step = "category" | "form" | "done";

type Submission = {
  categoryLabel: string;
  oldVehicle: string;
  newVehicleName: string;
  difference: number;
  name: string;
  mobile: string;
};

function Page() {
  const navigate = useNavigate();
  const { view, cat } = Route.useSearch();

  // Step 2 — old vehicle details (controlled so the estimate updates live).
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [oldYear, setOldYear] = useState("");
  const [oldKm, setOldKm] = useState("");
  const [fuel, setFuel] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);

  // Step 3 — desired vehicle.
  const [newVehicle, setNewVehicle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pendingScroll = useRef<string | null>(null);

  const category = getBuyCategory(cat) ?? null;
  const step: Step =
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
      navigate({ to: "/exchange", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, submission, navigate]);

  /* Derived, always-valid selections — same Brand → Model → Fuel chain as Sell. */
  const brands = category ? brandTilesFor(category.id) : [];
  const safeBrand = brands.some((b) => b.brand === brand) ? brand : "";
  const models = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const safeModel = models.includes(model) ? model : "";
  const fuels = category
    ? fuelOptionsFor(category.id, safeBrand || undefined, safeModel || undefined)
    : [];
  const safeFuel = fuels.includes(fuel) ? fuel : "";

  /* Step 2 output — the dummy estimate, live once brand+model+year+km exist. */
  const kmNumber = oldKm === "" ? NaN : Number(oldKm);
  const estimateReady = Boolean(category && safeBrand && safeModel && oldYear && oldKm !== "" && Number.isFinite(kmNumber) && kmNumber >= 0);
  const estimate = estimateReady && category
    ? estimateExchangeValue(category.id, Number(oldYear), kmNumber)
    : 0;

  /* Step 3 + 4 — chosen listing and the price-difference math. */
  const newListing: BuyListing | null = newVehicle ? LISTING_BY_ID.get(newVehicle) ?? null : null;
  const newPrice = newListing ? Math.round(newListing.priceLakh * 100000) : 0;
  const difference = newPrice - estimate;
  const payable = Math.max(0, difference);
  const showCalc = Boolean(estimateReady && newListing);

  const resetFlowState = () => {
    setBrand("");
    setModel("");
    setOldYear("");
    setOldKm("");
    setFuel("");
    setPhotos([]);
    setNewVehicle("");
    setError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetFlowState();
    pendingScroll.current = "exchange-form";
    navigate({ to: "/exchange", search: { view: "form", cat: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "exchange-categories";
    navigate({ to: "/exchange", search: {} });
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
    const transmission = value("transmission");
    const name = value("name");
    const mobile = value("mobile");

    if (!estimateReady || !newListing) {
      setError("Please complete your vehicle details and choose the vehicle you want to buy.");
      return;
    }
    if (!transmission || !name) {
      setError("Please fill in every required field before submitting.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError(null);

    const newVehicleName = buyListingName(newListing);

    // Persist through the project's lead capture — local lead queue first, CRM
    // endpoint (VITE_LEAD_ENDPOINT) second — so the team receives the request.
    await submitLead({
      type: "exchange_vehicle",
      source: "exchange",
      vehicleName: newVehicleName,
      name,
      mobile,
      fields: {
        category: activeCategory.label,
        oldBrand: safeBrand,
        oldModel: safeModel,
        oldYear,
        oldKilometres: oldKm,
        oldFuel: safeFuel,
        oldTransmission: transmission,
        estimatedValue: String(estimate),
        newVehicle: newVehicleName,
        newVehiclePrice: String(newPrice),
        difference: String(payable),
        name,
        mobile,
      },
      photos,
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      oldVehicle: `${oldYear} ${safeBrand} ${safeModel}`.trim(),
      newVehicleName,
      difference: payable,
      name,
      mobile,
    });
    pendingScroll.current = "exchange-done";
    navigate({ to: "/exchange", search: { view: "done", cat: activeCategory.id } });
  };

  const restart = () => {
    resetFlowState();
    setSubmission(null);
    pendingScroll.current = "exchange-categories";
    navigate({ to: "/exchange", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to exchange my vehicle.");

  return (
    <div id="top" className="mw-sell mw-ex min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Exchange · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Exchange Your Vehicle <em>Upgrade Easily</em>
            </h1>
            <p className="mw-sell-hero-text">
              Trade your current vehicle against anything from our listings — see the estimated
              value of your old vehicle and the exact price difference before you talk to us.
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
            <div className="mw-sell-steps" aria-label="Exchange flow steps">
              {["Choose Category", "Exchange Details", "Submitted"].map((label, i) => (
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
          <section
            id="exchange-categories"
            className="mw-sell-section"
            aria-labelledby="exchange-cats-title"
          >
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="exchange-cats-title" className="mw-sell-title">
                What are you <span>exchanging?</span>
              </h2>
              <p className="mw-sell-text">
                Pick the category of your current vehicle — the form adapts with the right brands
                and models, then shows your exchange maths.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Exchange ${item.singular}`}
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

        {/* ---------------- Steps 2–5: the glass exchange form ---------------- */}
        {step === "form" && category && (
          <section
            id="exchange-form"
            className="mw-sell-form-section"
            aria-labelledby="exchange-form-title"
          >
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Exchanging <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                {/* Step 2 — old vehicle details */}
                <div className="mw-ex-block">
                  <h2 id="exchange-form-title" className="mw-sell-form-title">
                    Your Current <span>{category.singular}</span> (To Exchange)
                  </h2>
                  <p className="mw-sell-form-sub">
                    Brands and models come from our {category.label} catalogue. Fields marked *
                    are required.
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
                        <option value="">
                          {safeBrand ? "Select model" : "Select a brand first"}
                        </option>
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
                      <select
                        name="year"
                        required
                        className="mw-sell-input"
                        value={oldYear}
                        onChange={(event) => setOldYear(event.target.value)}
                      >
                        <option value="">Select year</option>
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
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
                        placeholder="e.g. 45000"
                        value={oldKm}
                        onChange={(event) => setOldKm(event.target.value)}
                      />
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Fuel Type *</span>
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

                    <div className="mw-sell-photos">
                      <span className="mw-sell-field-label">
                        Photo Upload <small>— multiple images of your current vehicle</small>
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
                            : "No photos yet — photos help us confirm your exchange value."}
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

                    {/* Step 2 output — live dummy estimate */}
                    {estimateReady && (
                      <div className="mw-ex-estimate" aria-live="polite">
                        <span className="mw-ex-estimate-label">Estimated Value of Your Vehicle</span>
                        <strong className="mw-ex-estimate-value">{rupees(estimate)}</strong>
                        <span className="mw-ex-estimate-note">
                          Indicative estimate based on year ({oldYear}) and kilometres (
                          {Number(oldKm).toLocaleString("en-IN")} km) — the final value is
                          confirmed after a Motor Wallah inspection.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3 — desired vehicle */}
                <div className="mw-ex-block">
                  <h2 className="mw-sell-form-title">Which vehicle do you want to buy?</h2>
                  <div className="mw-sell-fields">
                    <label className="mw-sell-field mw-sell-field--full">
                      <span className="mw-sell-field-label">
                        Select from our existing listings *
                      </span>
                      <select
                        name="newVehicle"
                        required
                        className="mw-sell-input"
                        value={newVehicle}
                        onChange={(event) => setNewVehicle(event.target.value)}
                      >
                        <option value="">
                          {estimateReady
                            ? "Choose your desired vehicle"
                            : "Fill your current vehicle details first"}
                        </option>
                        {BUY_CATEGORY_LIST.map((group) => {
                          const options = listingsInCategory(group.id);
                          if (!options.length) return null;
                          return (
                            <optgroup key={group.id} label={group.label}>
                              {options.map((listing) => (
                                <option key={listing.id} value={listing.id}>
                                  {buyListingName(listing)} ·{" "}
                                  {rupees(Math.round(listing.priceLakh * 100000))}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </label>

                    {/* Step 4 — price difference calculator */}
                    {showCalc && newListing && (
                      <div className="mw-ex-calc" aria-label="Price difference calculation">
                        <p className="mw-ex-calc-title">Price Difference Calculator</p>
                        <div className="mw-ex-calc-row">
                          <span>New Vehicle Price</span>
                          <strong className="mw-ex-calc-new">{rupees(newPrice)}</strong>
                        </div>
                        <div className="mw-ex-calc-row">
                          <span>Old Vehicle Value</span>
                          <strong className="mw-ex-calc-old">− {rupees(estimate)}</strong>
                        </div>
                        <div className="mw-ex-calc-row mw-ex-calc-row--total">
                          <span>Total Price Difference (You Pay)</span>
                          <strong className="mw-ex-calc-total">{rupees(payable)}</strong>
                        </div>
                        {difference < 0 && (
                          <p className="mw-ex-calc-note">
                            Your vehicle's estimated value is {rupees(Math.abs(difference))}{" "}
                            higher than the new vehicle — our team will confirm the payout to you.
                          </p>
                        )}
                        <p className="mw-ex-calc-formula">
                          New Vehicle Price − Old Vehicle Value = Difference
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 5 — contact */}
                <div className="mw-ex-block">
                  <h2 className="mw-sell-form-title">Contact Details</h2>
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
                </div>

                {error && (
                  <p className="mw-sell-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="mw-sell-form-foot">
                  <button type="submit" className="mw-sell-submit">
                    Submit Exchange Request
                  </button>
                  <p className="mw-sell-form-note">
                    Your request — old vehicle details, chosen new vehicle, price difference and
                    contact — is saved to Motor Wallah's lead queue so the team can follow up.
                    Connect your CRM endpoint (VITE_LEAD_ENDPOINT) and it is also delivered there
                    automatically.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Success ---------------- */}
        {step === "done" && category && submission && (
          <section id="exchange-done" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">Exchange Request Submitted</h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your exchange request is saved with the Motor Wallah
                team. We will contact you on {submission.mobile} to confirm the inspection,
                valuation and next steps.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>Old: {submission.oldVehicle}</span>
                <span>New: {submission.newVehicleName}</span>
                <span>You pay {rupees(submission.difference)}</span>
              </div>
              <p className="mw-sell-done-note">
                Saved to this project's lead queue — when your CRM endpoint
                (VITE_LEAD_ENDPOINT) is connected, every submission is delivered to your team
                automatically. Want a faster reply now? Use WhatsApp or call us directly.
              </p>
              <div className="mw-sell-done-actions">
                <button type="button" className="mw-sell-submit" onClick={restart}>
                  Start Another Exchange
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
