import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Info,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { BrandArt } from "@/components/buy/BrandArt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUY_CATEGORY_LIST,
  BUY_YEAR_MAX,
  BUY_YEAR_MIN,
  brandTilesFor,
  catalogModelsFor,
  getBuyCategory,
  rupees,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import {
  DISCONTINUED_BRANDS,
  DISCONTINUED_BRAND_WARNING,
  OLD_VEHICLE_NOTE,
  POLICY_TYPES,
  getInsurer,
  insurerLogo,
  isDiscontinuedBrand,
  isThirdPartyOnly,
  premiumBreakdown,
  premiumFor,
  quotesFor,
  vehicleAge,
  type Insurer,
  type PolicyType,
  type QuoteInput,
} from "@/lib/insurance-plans";
import {
  POLICY_STATUSES,
  isReferenceId,
  livePolicyStage,
  newReferenceId,
  policyWhatsAppMessage,
  samplePolicyStage,
  type PolicyStatus,
} from "@/lib/insurance-tracking";
import { readLeadQueue, submitLead, type Lead } from "@/lib/leads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Vehicle Insurance — Instant Quote & Compare | Motor Wallah";
const DESCRIPTION =
  "Insure any vehicle in seconds: pick the category and vehicle, get an instant premium estimate, compare top insurers side by side and track your policy status with a reference ID.";

export const Route = createFileRoute("/insurance")({
  validateSearch: (search: Record<string, unknown>): InsuranceSearch => {
    const view = search["view"];
    const cat = search["cat"];
    const ref = search["ref"];
    return {
      view: view === "quote" || view === "success" || view === "track" ? view : undefined,
      cat: isCategoryId(cat) ? cat : undefined,
      ref: typeof ref === "string" && isReferenceId(ref) ? ref.trim().toUpperCase() : undefined,
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

type InsuranceSearch = {
  /** URL-driven steps: /insurance, ?view=quote, ?view=success, ?view=track. */
  view?: "quote" | "success" | "track" | undefined;
  cat?: BuyCategoryId | undefined;
  ref?: string | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

const STEPS = ["Choose Category", "Vehicle & Policy", "Compare & Select"];

const FALLBACK_STATUS: PolicyStatus = {
  key: "submitted",
  label: "Submitted",
  text: POLICY_STATUSES[0]?.text ?? "",
};

const statusAt = (index: number): PolicyStatus =>
  POLICY_STATUSES[Math.min(Math.max(index, 0), POLICY_STATUSES.length - 1)] ?? FALLBACK_STATUS;

/** Every brand the category offers, including the two discontinued ones. */
const brandsForInsurance = (categoryId: BuyCategoryId): string[] => {
  const brands = brandTilesFor(categoryId).map((b) => b.brand);
  if (categoryId === "cars") {
    for (const brand of DISCONTINUED_BRANDS) {
      if (!brands.includes(brand)) brands.push(brand);
    }
  }
  return brands;
};

const policyTypeLabel = (policyType: PolicyType) =>
  POLICY_TYPES.find((p) => p.id === policyType)?.label ?? "Comprehensive";

const insuranceLeads = () => readLeadQueue().filter((lead) => lead.type === "insurance_enquiry");

const leadByReference = (referenceId: string): Lead | undefined =>
  insuranceLeads()
    .slice()
    .reverse()
    .find((lead) => lead.fields?.["referenceId"] === referenceId);

function Page() {
  const navigate = useNavigate();
  const { view, cat, ref } = Route.useSearch();

  // Step 2 — vehicle + policy choices.
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [policyType, setPolicyType] = useState<PolicyType>("comprehensive");
  const [ncb, setNcb] = useState(false);

  // Step 4 — lead capture dialog for the selected plan.
  const [plan, setPlan] = useState<Insurer | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 5 — policy status tracking.
  const [trackInput, setTrackInput] = useState(ref ?? "");
  const [trackResult, setTrackResult] = useState<{
    referenceId: string;
    stage: number;
    found: boolean;
  } | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const trackCreatedRef = useRef<number | null>(null);
  const pendingScroll = useRef<string | null>(null);

  const category = getBuyCategory(cat) ?? null;
  const step =
    view === "track"
      ? "track"
      : view === "success" && ref
        ? "success"
        : view === "quote" && category
          ? "quote"
          : "category";
  const stepIndex = step === "category" ? 0 : step === "success" ? 2 : 1;

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Defensive fallback for stale quote URLs — back to the category grid.
  useEffect(() => {
    if (view !== "quote" || category) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/insurance", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, navigate]);

  useEffect(() => {
    setTrackInput(ref ?? "");
  }, [ref]);

  // Live tick: a real application's status advances while the screen is open.
  useEffect(() => {
    if (!trackResult?.found) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [trackResult]);

  const brands = category ? brandsForInsurance(category.id) : [];
  const safeBrand = brands.includes(brand) ? brand : "";
  const models = category && safeBrand ? catalogModelsFor(category.id, safeBrand) : [];
  const safeModel = models.includes(model) ? model : "";
  const safeYear = YEARS.includes(year) ? year : "";
  const yearNumber = safeYear ? Number(safeYear) : 0;

  const discontinued = Boolean(safeBrand) && isDiscontinuedBrand(safeBrand);
  const thirdPartyOnly = yearNumber > 0 && isThirdPartyOnly(yearNumber);

  // Smart rule: a vehicle older than ten years can only be insured third-party.
  useEffect(() => {
    if (thirdPartyOnly && policyType !== "third-party") setPolicyType("third-party");
  }, [thirdPartyOnly, policyType]);

  const quoteInput: QuoteInput | null =
    category && safeBrand && safeModel && safeYear
      ? {
          categoryId: category.id,
          year: Number(safeYear),
          policyType,
          ncb: ncb && policyType === "comprehensive",
        }
      : null;

  const breakdown = quoteInput ? premiumBreakdown(quoteInput) : null;
  const quotes = quoteInput ? quotesFor(quoteInput) : [];
  const vehicleName = [safeYear, safeBrand, safeModel].filter(Boolean).join(" ");
  const ncbApplied = quoteInput?.ncb ?? false;

  const successLead = useMemo(() => (ref ? leadByReference(ref) : null), [ref]);

  const trackLead = trackResult ? leadByReference(trackResult.referenceId) : null;
  const trackStage = trackResult
    ? trackResult.found && trackCreatedRef.current !== null
      ? livePolicyStage(trackCreatedRef.current, now)
      : trackResult.stage
    : 0;
  const trackStatus = statusAt(trackStage);

  const resetQuoteState = () => {
    setBrand("");
    setModel("");
    setYear("");
    setPolicyType("comprehensive");
    setNcb(false);
    setPlan(null);
    setLeadError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetQuoteState();
    pendingScroll.current = "insurance-quote";
    navigate({ to: "/insurance", search: { view: "quote", cat: id } });
  };

  const backToCategories = () => {
    resetQuoteState();
    pendingScroll.current = "insurance-categories";
    navigate({ to: "/insurance", search: {} });
  };

  const openTrack = (referenceId?: string) => {
    setTrackResult(null);
    setTrackError(null);
    pendingScroll.current = "insurance-track";
    navigate({
      to: "/insurance",
      search: { view: "track", ref: referenceId ?? ref },
    });
  };

  const onConfirmPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!plan || !category || !quoteInput) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "")
      .trim()
      .slice(0, 80);
    const mobile = String(data.get("mobile") ?? "")
      .trim()
      .slice(0, 15);

    if (name.length < 2) {
      setLeadError("Please enter your full name.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setLeadError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLeadError(null);
    setSubmitting(true);

    const referenceId = newReferenceId(
      insuranceLeads().map((lead) => lead.fields?.["referenceId"] ?? ""),
    );
    const premium = premiumFor(plan, quoteInput);

    await submitLead({
      type: "insurance_enquiry",
      source: "insurance",
      vehicleName,
      name,
      mobile,
      fields: {
        referenceId,
        category: category.label,
        brand: safeBrand,
        model: safeModel,
        year: safeYear,
        vehicleName,
        policyType: policyTypeLabel(quoteInput.policyType),
        ncb: ncbApplied ? "Yes (20%)" : "No",
        insurer: plan.id,
        insurerName: plan.name,
        premium: String(premium),
        idv: String(breakdown?.idv ?? 0),
        name,
        mobile,
      },
    });

    setSubmitting(false);
    setPlan(null);
    pendingScroll.current = "insurance-success";
    navigate({
      to: "/insurance",
      search: { view: "success", cat: category.id, ref: referenceId },
    });
  };

  const onTrack = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = String(data.get("referenceId") ?? "")
      .trim()
      .toUpperCase();

    if (!isReferenceId(value)) {
      setTrackError("Enter a valid Reference ID in the format MW-INS-12345.");
      setTrackResult(null);
      return;
    }

    const lead = leadByReference(value);
    setTrackError(null);
    if (lead) {
      trackCreatedRef.current = Date.parse(lead.createdAt);
      setTrackResult({
        referenceId: value,
        stage: livePolicyStage(Date.parse(lead.createdAt), Date.now()),
        found: true,
      });
    } else {
      trackCreatedRef.current = null;
      setTrackResult({ referenceId: value, stage: samplePolicyStage(value), found: false });
    }
    setNow(Date.now());
    window.setTimeout(
      () => document.getElementById("insurance-track-result")?.scrollIntoView({ block: "start" }),
      60,
    );
  };

  const copyReference = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the ID is visible on screen anyway */
    }
  };

  const successInsurer = getInsurer(successLead?.fields?.["insurer"]);
  const successVehicle = successLead?.vehicleName ?? vehicleName;
  const successWhatsApp = whatsappLink(
    policyWhatsAppMessage(ref ?? "", successVehicle, successInsurer?.name ?? "Insurer"),
  );

  return (
    <div id="top" className="mw-sell mw-ins min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Insurance · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Vehicle Insurance <em>Instant Quote &amp; Compare</em>
            </h1>
            <p className="mw-sell-hero-text">
              Pick your vehicle and policy type once — the estimated premium appears instantly, the
              top insurers are compared side by side, and every application gets a reference ID you
              can track.
            </p>
            <div className="mw-sell-hero-actions">
              <a
                className="mw-sell-ghost-btn"
                href={whatsappLink("Hi Motor Wallah, I need help with vehicle insurance.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
              <button type="button" className="mw-sell-ghost-btn" onClick={() => openTrack()}>
                <Timer size={14} /> Track Policy Status
              </button>
            </div>
            <div className="mw-sell-steps" aria-label="Insurance flow steps">
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

        {/* ---------------- Step 1: category grid ---------------- */}
        {step === "category" && (
          <section
            id="insurance-categories"
            className="mw-sell-section"
            aria-labelledby="insurance-cats-title"
          >
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="insurance-cats-title" className="mw-sell-title">
                What are you <span>insuring?</span>
              </h2>
              <p className="mw-sell-text">
                Pick the vehicle category first — premiums, cover and the insurer panel are quoted
                for that type of vehicle.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Insure ${item.singular}`}
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

        {/* ---------------- Step 2: vehicle + policy + instant quote ---------------- */}
        {step === "quote" && category && (
          <section
            id="insurance-quote"
            className="mw-sell-form-section"
            aria-labelledby="insurance-form-title"
          >
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Insuring <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form
                className="mw-sell-form"
                onSubmit={(event) => event.preventDefault()}
                aria-labelledby="insurance-form-title"
              >
                <div className="mw-ins-block">
                  <h2 id="insurance-form-title" className="mw-sell-form-title">
                    Vehicle &amp; <span>Policy</span>
                  </h2>
                  <p className="mw-sell-form-sub">
                    Choose the brand, model and year — the premium estimate updates as you pick.
                  </p>

                  <div className="mw-ins-brand-head">
                    <span className="mw-sell-field-label">Brand *</span>
                    {safeBrand && (
                      <span className="mw-ins-compare-note">
                        {safeBrand} selected · {models.length} models
                      </span>
                    )}
                  </div>
                  <div className="mw-ins-brand-scroll">
                    <div className="mw-ins-brand-grid" role="group" aria-label="Vehicle brand">
                      {brands.map((item) => (
                        <button
                          key={item}
                          type="button"
                          data-testid="brand-tile"
                          data-brand={item}
                          aria-pressed={safeBrand === item}
                          className={`mw-ins-brand${safeBrand === item ? " mw-ins-brand--active" : ""}`}
                          onClick={() => {
                            setBrand(item);
                            setModel("");
                          }}
                        >
                          <BrandArt brand={item} className="mw-ins-brand-logo" />
                          <span className="mw-ins-brand-name">{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mw-sell-fields mw-ins-block">
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Model *</span>
                      <select
                        name="model"
                        required
                        className="mw-sell-input"
                        data-testid="model-select"
                        value={safeModel}
                        disabled={!safeBrand}
                        onChange={(event) => setModel(event.target.value)}
                      >
                        <option value="">
                          {safeBrand ? "Select model" : "Select a brand first"}
                        </option>
                        {models.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">
                        Year{" "}
                        <small>
                          ({BUY_YEAR_MIN}–{BUY_YEAR_MAX})
                        </small>{" "}
                        *
                      </span>
                      <select
                        name="year"
                        required
                        className="mw-sell-input"
                        data-testid="year-select"
                        value={safeYear}
                        onChange={(event) => setYear(event.target.value)}
                      >
                        <option value="">Select year</option>
                        {YEARS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mw-sell-field mw-sell-field--full">
                      <span className="mw-sell-field-label">Policy Type *</span>
                      <div className="mw-ins-seg" role="group" aria-label="Policy type">
                        {POLICY_TYPES.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            data-testid={`policy-${option.id}`}
                            aria-pressed={policyType === option.id}
                            disabled={option.id === "comprehensive" && thirdPartyOnly}
                            className={`mw-ins-seg-btn${
                              policyType === option.id ? " mw-ins-seg-btn--active" : ""
                            }`}
                            onClick={() => setPolicyType(option.id)}
                          >
                            {option.label}
                            <small>
                              {option.id === "comprehensive" && thirdPartyOnly
                                ? "Not available above 10 years"
                                : option.blurb}
                            </small>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mw-sell-field mw-sell-field--full">
                      <label className="mw-ins-toggle">
                        <span className="mw-ins-toggle-text">
                          <strong>I have No Claim Bonus (NCB)</strong>
                          <small>
                            {policyType === "third-party"
                              ? "NCB reduces the own-damage premium — it applies to comprehensive cover only."
                              : "20% off the own-damage premium on a claim-free year."}
                          </small>
                        </span>
                        <span className="mw-ins-switch" data-on={ncbApplied}>
                          <input
                            type="checkbox"
                            data-testid="ncb-toggle"
                            aria-label="I have No Claim Bonus"
                            checked={ncb}
                            disabled={policyType === "third-party"}
                            onChange={(event) => setNcb(event.target.checked)}
                          />
                          <span aria-hidden="true" />
                        </span>
                      </label>
                    </div>

                    {discontinued && (
                      <div
                        className="mw-ins-hint mw-ins-hint--warn"
                        role="status"
                        data-testid="discontinued-warning"
                      >
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>
                          <strong>Discontinued brand:</strong> {DISCONTINUED_BRAND_WARNING}
                        </span>
                      </div>
                    )}

                    {thirdPartyOnly && (
                      <div className="mw-ins-hint" role="status" data-testid="old-vehicle-note">
                        <Info size={16} aria-hidden="true" />
                        <span>
                          <strong>{vehicleAge(yearNumber)}-year-old vehicle:</strong>{" "}
                          {OLD_VEHICLE_NOTE}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </form>

              {/* -------- Step 3: instant premium estimate -------- */}
              {quoteInput && breakdown ? (
                <div className="mw-ins-quote" data-testid="instant-quote">
                  <div className="mw-ins-quote-main">
                    <span className="mw-ins-quote-label">Instant estimate · starting from</span>
                    <p className="mw-ins-quote-value" data-testid="quote-premium">
                      {rupees(Math.min(...quotes.map((q) => q.premium)))}
                      <small> / year, incl. GST</small>
                    </p>
                    <span className="mw-ins-quote-vehicle">{vehicleName}</span>
                    <div className="mw-ins-quote-meta">
                      <span>{policyTypeLabel(quoteInput.policyType)}</span>
                      <span>IDV {rupees(breakdown.idv)}</span>
                      <span>{ncbApplied ? "NCB 20% applied" : "No NCB declared"}</span>
                      <span>{vehicleAge(quoteInput.year)} yr old</span>
                    </div>
                  </div>

                  <div className="mw-ins-quote-breakdown">
                    {quoteInput.policyType === "comprehensive" ? (
                      <>
                        <div className="mw-ins-quote-row">
                          <span>Own damage premium</span>
                          <strong>{rupees(breakdown.ownDamage)}</strong>
                        </div>
                        <div className="mw-ins-quote-row">
                          <span>Third-party premium</span>
                          <strong>{rupees(breakdown.thirdParty)}</strong>
                        </div>
                        {breakdown.ncbSaving > 0 && (
                          <div className="mw-ins-quote-row mw-ins-quote-row--save">
                            <span>No Claim Bonus (−20%)</span>
                            <strong>−{rupees(breakdown.ncbSaving)}</strong>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mw-ins-quote-row">
                        <span>Third-party premium</span>
                        <strong>{rupees(breakdown.thirdParty)}</strong>
                      </div>
                    )}
                    <div className="mw-ins-quote-row">
                      <span>Reference premium</span>
                      <strong>{rupees(Math.round(breakdown.base))}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mw-ins-quote-placeholder">
                  <Sparkles size={18} aria-hidden="true" />
                  <span>
                    Choose a brand, model and year above — your estimated premium and the insurer
                    comparison appear instantly, no form submission needed.
                  </span>
                </div>
              )}

              {/* -------- Step 3: compare top insurers -------- */}
              <div className="mw-ins-compare">
                <div className="mw-ins-compare-head">
                  <div>
                    <p className="mw-sell-kicker">
                      <span aria-hidden="true" /> Compare top insurers
                    </p>
                    <h2 className="mw-sell-form-title">
                      Pick the <span>right cover</span>
                    </h2>
                  </div>
                  <span className="mw-ins-compare-note">
                    Sample premiums for this preview — the final quote is issued by the insurer.
                  </span>
                </div>

                {quoteInput ? (
                  <ul className="mw-ins-grid" data-testid="insurer-grid">
                    {quotes.map((quote) => (
                      <li
                        key={quote.insurer.id}
                        className={`mw-ins-card${quote.best ? " mw-ins-card--best" : ""}`}
                        data-testid="insurer-card"
                        data-insurer={quote.insurer.id}
                      >
                        {quote.insurer.badge && (
                          <span className="mw-ins-badge">{quote.insurer.badge}</span>
                        )}
                        <div className="mw-ins-card-top">
                          <InsurerLogo insurer={quote.insurer} />
                          <span className="mw-ins-name" data-testid="insurer-name">
                            {quote.insurer.name}
                          </span>
                        </div>
                        <p className="mw-ins-price" data-testid="insurer-price">
                          {rupees(quote.premium)}
                          <small>/ year</small>
                        </p>
                        <ul className="mw-ins-features">
                          {quote.insurer.features.map((feature) => (
                            <li key={feature}>
                              <Check size={13} aria-hidden="true" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mw-ins-select"
                          data-testid="select-plan"
                          onClick={() => {
                            setLeadError(null);
                            setPlan(quote.insurer);
                          }}
                        >
                          Select Plan <ArrowRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mw-ins-quote-placeholder" data-testid="insurers-awaiting-vehicle">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <span>
                      Add the brand, model and year to compare ICICI Lombard, HDFC ERGO, Bajaj
                      Allianz and Tata AIG for this vehicle.
                    </span>
                  </p>
                )}

                <div className="mw-ins-track-link">
                  <span>
                    Already applied? Check where your application stands with your Reference ID.
                  </span>
                  <button
                    type="button"
                    className="mw-sell-ghost-btn"
                    data-testid="track-link"
                    onClick={() => openTrack()}
                  >
                    <Timer size={14} /> Track Policy Status
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Steps 4–5: success + reference ID ---------------- */}
        {step === "success" && (
          <section id="insurance-success" className="home-container mw-ins-done">
            <div className="mw-sell-done" data-testid="policy-success">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">Insurance Application Submitted</h2>
              <p className="mw-sell-done-text">
                {successLead?.name ? `Thanks ${successLead.name} — ` : ""}
                your application {successInsurer ? `with ${successInsurer.name} ` : ""}
                is saved with the Motor Wallah insurance team. Keep the reference ID below to track
                the policy.
              </p>

              <div className="mw-ins-ref-card">
                <span className="mw-ins-ref-label">Your Reference ID</span>
                <strong className="mw-ins-ref-value" data-testid="reference-id">
                  {ref}
                </strong>
                <button
                  type="button"
                  className="mw-ins-ref-copy"
                  onClick={() => ref && copyReference(ref)}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
                  {copied ? "Copied" : "Copy ID"}
                </button>
              </div>

              <div className="mw-ins-summary">
                <div className="mw-ins-summary-cell">
                  <span>Vehicle</span>
                  <strong>{successVehicle || "Your vehicle"}</strong>
                </div>
                <div className="mw-ins-summary-cell">
                  <span>Insurer</span>
                  <strong>
                    {successInsurer?.name ?? successLead?.fields?.["insurerName"] ?? "—"}
                  </strong>
                </div>
                <div className="mw-ins-summary-cell">
                  <span>Policy</span>
                  <strong>
                    {successLead?.fields?.["policyType"] ?? policyTypeLabel(policyType)}
                  </strong>
                </div>
                <div className="mw-ins-summary-cell">
                  <span>Premium</span>
                  <strong>
                    {successLead?.fields?.["premium"]
                      ? rupees(Number(successLead.fields["premium"]))
                      : "—"}
                  </strong>
                </div>
                <div className="mw-ins-summary-cell">
                  <span>NCB</span>
                  <strong>
                    {successLead?.fields?.["ncb"] ?? (ncbApplied ? "Yes (20%)" : "No")}
                  </strong>
                </div>
                <div className="mw-ins-summary-cell">
                  <span>Mobile</span>
                  <strong>{successLead?.mobile ?? "—"}</strong>
                </div>
              </div>
            </div>

            <div className="mw-ins-success-actions">
              <a
                className="mw-sell-submit"
                href={successWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="whatsapp-updates"
              >
                <MessageCircle size={15} /> Get Updates on WhatsApp
              </a>
              <button
                type="button"
                className="mw-sell-ghost-btn"
                data-testid="success-track-link"
                onClick={() => openTrack(ref)}
              >
                <Timer size={14} /> Track Policy Status
              </button>
              <button
                type="button"
                className="mw-sell-ghost-btn"
                onClick={() => {
                  resetQuoteState();
                  pendingScroll.current = "insurance-categories";
                  navigate({ to: "/insurance", search: {} });
                }}
              >
                New Quote
              </button>
            </div>

            {!successLead && (
              <p className="mw-ins-track-note">
                <Info size={14} aria-hidden="true" />
                This application was submitted from another device — use the reference ID to track
                it, or contact us on WhatsApp for the policy copy.
              </p>
            )}
          </section>
        )}

        {/* ---------------- Step 5: track policy status ---------------- */}
        {step === "track" && (
          <>
            <section
              id="insurance-track"
              className="mw-sell-form-section"
              aria-labelledby="track-title"
            >
              <div className="home-container">
                <div className="mw-sell-form-head">
                  <button type="button" className="mw-sell-back" onClick={backToCategories}>
                    <ArrowLeft size={14} /> Back to Insurance
                  </button>
                  <span className="mw-sell-chip">
                    <ClipboardCheck size={16} aria-hidden="true" />
                    <span>
                      Policy Status <small>MW-INS-#####</small>
                    </span>
                  </span>
                </div>

                <form className="mw-sell-form" onSubmit={onTrack}>
                  <h2 id="track-title" className="mw-sell-form-title">
                    Track <span>policy status</span>
                  </h2>
                  <p className="mw-sell-form-sub">
                    Enter the reference ID you received after selecting a plan. Fields marked * are
                    required.
                  </p>

                  <div className="mw-sell-fields">
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Reference ID *</span>
                      <input
                        className="mw-sell-input"
                        type="text"
                        name="referenceId"
                        required
                        maxLength={12}
                        pattern="MW-INS-[0-9]{5}"
                        placeholder="MW-INS-12345"
                        value={trackInput}
                        data-testid="track-ref-input"
                        onChange={(event) => setTrackInput(event.target.value.toUpperCase())}
                      />
                    </label>
                  </div>

                  {trackError && (
                    <p className="mw-sell-error" role="alert" data-testid="track-error">
                      {trackError}
                    </p>
                  )}

                  <div className="mw-sell-form-foot">
                    <button type="submit" className="mw-sell-submit">
                      Track Policy Status
                    </button>
                    <p className="mw-sell-form-note">
                      Statuses are simulated for this preview — connect the insurer feed later to
                      make them fully live.
                    </p>
                  </div>
                </form>
              </div>
            </section>

            {trackResult && (
              <section
                id="insurance-track-result"
                className="mw-sell-form-section"
                aria-live="polite"
              >
                <div className="home-container">
                  <div className="mw-ins-track" data-testid="track-result">
                    <div className="mw-ins-track-head">
                      <div>
                        <span className="mw-ins-ref-label">Reference ID</span>
                        <p className="mw-ins-track-id">{trackResult.referenceId}</p>
                      </div>
                      <span className="mw-ins-status-pill" data-stage={trackStatus.key}>
                        {trackStatus.label}
                      </span>
                    </div>

                    <p className="mw-ins-stage-text" data-testid="track-current">
                      Current status: <strong>{trackStatus.label}</strong> — {trackStatus.text}
                    </p>

                    <div
                      className="mw-ins-bar"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={POLICY_STATUSES.length}
                      aria-valuenow={trackStage + 1}
                      aria-label="Policy progress"
                    >
                      <span
                        className="mw-ins-bar-fill"
                        style={{ width: `${(trackStage / (POLICY_STATUSES.length - 1)) * 100}%` }}
                      />
                    </div>

                    <ol className="mw-ins-timeline" data-testid="track-stages">
                      {POLICY_STATUSES.map((status, index) => (
                        <li
                          key={status.key}
                          className="mw-ins-stage"
                          data-state={
                            index < trackStage ? "done" : index === trackStage ? "current" : "next"
                          }
                        >
                          <span className="mw-ins-dot" aria-hidden="true">
                            {index < trackStage ? <Check size={13} /> : index + 1}
                          </span>
                          <span className="mw-ins-stage-label">{status.label}</span>
                          <span className="mw-ins-stage-text">{status.text}</span>
                        </li>
                      ))}
                    </ol>

                    {trackLead ? (
                      <div className="mw-ins-summary">
                        <div className="mw-ins-summary-cell">
                          <span>Vehicle</span>
                          <strong>{trackLead.vehicleName ?? "Your vehicle"}</strong>
                        </div>
                        <div className="mw-ins-summary-cell">
                          <span>Insurer</span>
                          <strong>{trackLead.fields?.["insurerName"] ?? "—"}</strong>
                        </div>
                        <div className="mw-ins-summary-cell">
                          <span>Policy</span>
                          <strong>{trackLead.fields?.["policyType"] ?? "—"}</strong>
                        </div>
                        <div className="mw-ins-summary-cell">
                          <span>Premium</span>
                          <strong>
                            {trackLead.fields?.["premium"]
                              ? rupees(Number(trackLead.fields["premium"]))
                              : "—"}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="mw-ins-track-note">
                        <Info size={14} aria-hidden="true" />
                        No application was submitted from this device with that reference ID, so a
                        sample status is shown. Our team can confirm the real status on WhatsApp.
                      </p>
                    )}

                    <div className="mw-ins-success-actions">
                      <a
                        className="mw-sell-ghost-btn"
                        href={whatsappLink(
                          policyWhatsAppMessage(
                            trackResult.referenceId,
                            trackLead?.vehicleName ?? "My vehicle",
                            trackLead?.fields?.["insurerName"] ?? "Insurer",
                          ),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={14} /> Get Updates on WhatsApp
                      </a>
                      <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                        <Phone size={14} /> Call {PHONE_DISPLAY}
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ---------------- Step 4: lead capture for the selected plan ---------------- */}
      <Dialog open={plan !== null} onOpenChange={(open) => !open && setPlan(null)}>
        <DialogContent className="mw-ins-modal" data-testid="plan-dialog">
          <DialogHeader>
            <DialogTitle className="mw-ins-modal-title">Confirm your plan</DialogTitle>
            <DialogDescription>
              Share your name and mobile number — we generate a reference ID and the insurance team
              takes it forward.
            </DialogDescription>
          </DialogHeader>

          {plan && quoteInput && (
            <div className="mw-ins-modal-plan">
              <span>
                <strong
                  style={{ display: "block", color: "var(--foreground)", fontSize: "0.85rem" }}
                >
                  {plan.name}
                </strong>
                {policyTypeLabel(quoteInput.policyType)} · {vehicleName}
              </span>
              <strong>{rupees(premiumFor(plan, quoteInput))}</strong>
            </div>
          )}

          <form className="mw-ins-modal-fields" onSubmit={onConfirmPlan}>
            <label className="mw-sell-field">
              <span className="mw-sell-field-label">Full Name *</span>
              <input
                className="mw-sell-input"
                type="text"
                name="name"
                required
                maxLength={80}
                placeholder="Your name"
                data-testid="lead-name"
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
                data-testid="lead-mobile"
              />
            </label>

            {leadError && (
              <p className="mw-sell-error" role="alert">
                {leadError}
              </p>
            )}

            <button
              type="submit"
              className="mw-sell-submit"
              disabled={submitting}
              data-testid="confirm-plan"
            >
              {submitting ? "Submitting…" : "Confirm & Get Reference ID"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <SiteFooter />
      <StickyActions />
    </div>
  );
}

/** Official insurer artwork with the project's typographic fallback. */
function InsurerLogo({ insurer }: { insurer: Insurer }) {
  const [failed, setFailed] = useState(false);
  const logo = insurerLogo(insurer);

  if (!logo || failed) {
    return (
      <span className="mw-ins-logo">
        <span className="mw-ins-wordmark" aria-hidden="true">
          {insurer.name.toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    <span className="mw-ins-logo">
      <img src={logo} alt={`${insurer.name} logo`} loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}
