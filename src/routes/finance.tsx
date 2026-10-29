import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  MessageCircle,
  Phone,
  Search,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
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
  ALL_LENDERS,
  CATEGORY_LENDERS,
  CIBIL_RANGES,
  DISCONTINUED_BRANDS,
  DISCONTINUED_BRAND_WARNING,
  LOW_CIBIL_RANGE,
  LOAN_TENURES,
  OCCUPATIONS,
  OWNER_SERIAL_OPTIONS,
  RESIDENTIAL_STATUSES,
  emiBreakdown,
  isDiscontinuedBrand,
  lendersByIds,
  type Lender,
} from "@/lib/finance-partners";
import { submitLead } from "@/lib/leads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Vehicle Finance — Banks & NBFCs | Motor Wallah";
const DESCRIPTION =
  "Apply for used vehicle finance across 8 categories, compare the top banks and NBFCs side by side and calculate your EMI before you talk to a lender.";

export const Route = createFileRoute("/finance")({
  validateSearch: (search: Record<string, unknown>): FinanceSearch => {
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

type FinanceSearch = {
  /** URL-driven steps: /finance = category grid, ?view=form, ?view=done. */
  view?: "form" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

const YEARS = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

const STEPS = ["Choose Category", "KYC & Vehicle", "Compare Options"];

type Submission = {
  categoryLabel: string;
  vehicleName: string;
  expectedPrice: number;
  downPayment: number;
  cibil: string;
  name: string;
  mobile: string;
  /** True when the applicant declared a weak/no credit score. */
  lowCibil: boolean;
};

/**
 * Real brand artwork already in the project, plus the two discontinued brands
 * used-car applicants still ask to finance (they carry no logo artwork here).
 */
const brandsForFinance = (categoryId: BuyCategoryId): string[] => {
  const brands = brandTilesFor(categoryId).map((b) => b.brand);
  if (categoryId === "cars") {
    for (const discontinued of DISCONTINUED_BRANDS) {
      if (!brands.includes(discontinued)) brands.push(discontinued);
    }
  }
  return brands;
};

function Page() {
  const navigate = useNavigate();
  const { view, cat } = Route.useSearch();

  // Step 2 — KYC & vehicle details.
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const pendingScroll = useRef<string | null>(null);

  // Step 3 — EMI calculator (prefilled from the submitted application).
  const [loanAmount, setLoanAmount] = useState(0);
  const [rate, setRate] = useState(11.5);
  const [tenure, setTenure] = useState(60);

  // Step 4 — lender tabs + "View All Partners" modal.
  const [activeTab, setActiveTab] = useState<"banks" | "nbfc">("banks");
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState("");

  const category = getBuyCategory(cat) ?? null;
  const step =
    view === "form" && category ? "form" : view === "done" && category ? "done" : "category";
  const stepIndex = step === "category" ? 0 : step === "form" ? 1 : 2;

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Defensive fallback for stale form/done URLs — return to the category grid.
  useEffect(() => {
    const invalid = (view === "form" && !category) || (view === "done" && !submission);
    if (!invalid) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/finance", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, submission, navigate]);

  const brands = category ? brandsForFinance(category.id) : [];
  const safeBrand = brands.includes(brand) ? brand : "";
  const models = safeBrand && category ? catalogModelsFor(category.id, safeBrand) : [];
  const safeModel = models.includes(model) ? model : "";
  const discontinued = Boolean(safeBrand) && isDiscontinuedBrand(safeBrand);

  const resetFlowState = () => {
    setBrand("");
    setModel("");
    setError(null);
  };

  const pickCategory = (id: BuyCategoryId) => {
    resetFlowState();
    pendingScroll.current = "finance-form";
    navigate({ to: "/finance", search: { view: "form", cat: id } });
  };

  const backToCategories = () => {
    resetFlowState();
    pendingScroll.current = "finance-categories";
    navigate({ to: "/finance", search: {} });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const activeCategory = category;
    if (!activeCategory) return;

    const data = new FormData(event.currentTarget);
    const value = (key: string) =>
      String(data.get(key) ?? "")
        .trim()
        .slice(0, 200);

    const name = value("name");
    const mobile = value("mobile");
    const pan = value("pan").toUpperCase();
    const aadhaar = value("aadhaar").replace(/\s+/g, "");
    const occupation = value("occupation");
    const residency = value("residency");
    const cibil = value("cibil");
    const year = value("year");
    const ownership = value("ownership");
    const expectedPrice = Number(value("expectedPrice"));
    const downPayment = Number(value("downPayment"));

    if (!safeBrand || !safeModel || !year || !ownership) {
      setError("Please complete every KYC and vehicle field before submitting.");
      return;
    }
    if (!occupation || !residency || !cibil) {
      setError("Please select your occupation, residential status and CIBIL range.");
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setError("Please enter a valid PAN (e.g. ABCDE1234F).");
      return;
    }
    if (!/^[0-9]{12}$/.test(aadhaar)) {
      setError("Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!Number.isFinite(expectedPrice) || expectedPrice < 10000) {
      setError("Please enter an expected price of at least ₹10,000.");
      return;
    }
    if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment >= expectedPrice) {
      setError("Down payment must be less than the expected vehicle price.");
      return;
    }
    setError(null);

    const vehicleName = `${year} ${safeBrand} ${safeModel}`;
    const lowCibil = cibil === LOW_CIBIL_RANGE;

    // Saved through the project's lead capture — local lead queue first, CRM
    // endpoint (VITE_LEAD_ENDPOINT) second — so the team receives the request.
    await submitLead({
      type: "finance_enquiry",
      source: "finance",
      vehicleName,
      name,
      mobile,
      fields: {
        category: activeCategory.label,
        pan,
        aadhaar,
        occupation,
        residentialStatus: residency,
        cibilRange: cibil,
        brand: safeBrand,
        model: safeModel,
        year,
        ownership,
        expectedPrice: String(expectedPrice),
        downPayment: String(downPayment),
        loanRequired: String(expectedPrice - downPayment),
        name,
        mobile,
      },
    });

    setSubmission({
      categoryLabel: activeCategory.label,
      vehicleName,
      expectedPrice,
      downPayment,
      cibil,
      name,
      mobile,
      lowCibil,
    });
    setLoanAmount(Math.max(0, expectedPrice - downPayment));
    setRate(11.5);
    setTenure(60);
    // Smart backend logic — a weak/no score is matched to NBFCs first.
    setActiveTab(lowCibil ? "nbfc" : "banks");
    setPartnerQuery("");
    pendingScroll.current = "finance-done";
    navigate({ to: "/finance", search: { view: "done", cat: activeCategory.id } });
  };

  const restart = () => {
    resetFlowState();
    setSubmission(null);
    setPartnersOpen(false);
    pendingScroll.current = "finance-categories";
    navigate({ to: "/finance", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to apply for vehicle finance.");

  const partners = category ? CATEGORY_LENDERS[category.id] : { banks: [], nbfc: [] };
  const bankLenders = lendersByIds(partners.banks);
  const nbfcLenders = lendersByIds(partners.nbfc);
  const activeLenders = activeTab === "banks" ? bankLenders : nbfcLenders;

  const breakdown = emiBreakdown(loanAmount, rate, tenure);

  const query = partnerQuery.trim().toLowerCase();
  const filteredPartners = query
    ? ALL_LENDERS.filter((l) => l.name.toLowerCase().includes(query))
    : ALL_LENDERS;

  return (
    <div id="top" className="mw-sell mw-fin min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Finance · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Vehicle Finance <em>Compare Banks & NBFCs</em>
            </h1>
            <p className="mw-sell-hero-text">
              Tell us about yourself and the vehicle once — we line up the top banks for a good
              CIBIL score and NBFCs for easy approval, with an EMI calculator before you apply.
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
            <div className="mw-sell-steps" aria-label="Finance flow steps">
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
            id="finance-categories"
            className="mw-sell-section"
            aria-labelledby="finance-cats-title"
          >
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="finance-cats-title" className="mw-sell-title">
                What are you <span>financing?</span>
              </h2>
              <p className="mw-sell-text">
                Pick the vehicle category — the partner list changes with it, because banks and
                NBFCs finance cars, bikes and commercial vehicles very differently.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Finance ${item.singular}`}
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

        {/* ---------------- Step 2: KYC & vehicle form ---------------- */}
        {step === "form" && category && (
          <section
            id="finance-form"
            className="mw-sell-form-section"
            aria-labelledby="finance-form-title"
          >
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Financing <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form" onSubmit={onSubmit}>
                <div className="mw-fin-block">
                  <h2 id="finance-form-title" className="mw-sell-form-title">
                    KYC Details
                  </h2>
                  <p className="mw-sell-form-sub">
                    Used only to match you with the right lender. Fields marked * are required.
                  </p>

                  <div className="mw-sell-fields">
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Full Name *</span>
                      <input
                        className="mw-sell-input"
                        type="text"
                        name="name"
                        required
                        maxLength={80}
                        placeholder="As per PAN"
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

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">PAN *</span>
                      <input
                        className="mw-sell-input"
                        type="text"
                        name="pan"
                        required
                        maxLength={10}
                        pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                        placeholder="ABCDE1234F"
                        style={{ textTransform: "uppercase" }}
                      />
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Aadhaar *</span>
                      <input
                        className="mw-sell-input"
                        type="text"
                        name="aadhaar"
                        required
                        maxLength={14}
                        pattern="[0-9 ]{12,14}"
                        inputMode="numeric"
                        placeholder="12-digit Aadhaar"
                      />
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Occupation *</span>
                      <select name="occupation" required defaultValue="" className="mw-sell-input">
                        <option value="">Select occupation</option>
                        {OCCUPATIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Residential Status *</span>
                      <select name="residency" required defaultValue="" className="mw-sell-input">
                        <option value="">Select status</option>
                        {RESIDENTIAL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mw-sell-field mw-sell-field--full">
                      <span className="mw-sell-field-label">CIBIL Score Range *</span>
                      <select name="cibil" required defaultValue="" className="mw-sell-input">
                        <option value="">Select your score range</option>
                        {CIBIL_RANGES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mw-fin-block">
                  <h2 className="mw-sell-form-title">
                    Vehicle Details — Your <span>{category.singular}</span>
                  </h2>
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
                          <option key={b} value={b}>
                            {b}
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
                      <span className="mw-sell-field-label">Owner Serial Number *</span>
                      <select name="ownership" required defaultValue="" className="mw-sell-input">
                        <option value="">Select ownership</option>
                        {OWNER_SERIAL_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Expected Price (₹) *</span>
                      <input
                        className="mw-sell-input"
                        type="number"
                        name="expectedPrice"
                        min={10000}
                        max={100000000}
                        required
                        inputMode="numeric"
                        placeholder="e.g. 650000"
                      />
                    </label>

                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Down Payment (₹) *</span>
                      <input
                        className="mw-sell-input"
                        type="number"
                        name="downPayment"
                        min={0}
                        max={100000000}
                        required
                        inputMode="numeric"
                        placeholder="e.g. 100000"
                      />
                    </label>

                    {discontinued && (
                      <div className="mw-fin-warn" role="status" data-testid="discontinued-warning">
                        <AlertTriangle size={17} aria-hidden="true" />
                        <span>
                          <strong>Discontinued brand:</strong> {DISCONTINUED_BRAND_WARNING}
                        </span>
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
                    Submit Finance Application
                  </button>
                  <p className="mw-sell-form-note">
                    Your KYC and vehicle details are saved to Motor Wallah's lead queue so our
                    finance team can match you with the right lender. Connect your CRM endpoint
                    (VITE_LEAD_ENDPOINT) and every submission is also delivered there.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* -------- Steps 3–5: thank you, EMI calculator, partner tabs -------- */}
        {step === "done" && category && submission && (
          <section id="finance-done" className="home-container mw-fin-done">
            <div className="mw-sell-done" data-testid="finance-success">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">Finance Application Received</h2>
              <p className="mw-sell-done-text">
                Thanks {submission.name} — your application for the {submission.vehicleName} is
                saved with the Motor Wallah finance team. We will call you on {submission.mobile} to
                confirm documents and lender options.
              </p>
              <div className="mw-sell-done-summary">
                <span>{submission.categoryLabel}</span>
                <span>{submission.vehicleName}</span>
                <span>Price {rupees(submission.expectedPrice)}</span>
                <span>Down payment {rupees(submission.downPayment)}</span>
                <span>CIBIL: {submission.cibil}</span>
              </div>
            </div>

            {/* ---------------- Step 3: EMI calculator ---------------- */}
            <div className="mw-fin-emi" aria-labelledby="emi-title">
              <div className="mw-fin-emi-head">
                <h2 id="emi-title" className="mw-sell-form-title">
                  EMI Calculator
                </h2>
                <p className="mw-sell-form-sub">
                  Loan of {rupees(Math.max(0, submission.expectedPrice - submission.downPayment))}{" "}
                  after your down payment — adjust the inputs to see the maths.
                </p>
              </div>

              <div className="mw-fin-emi-controls">
                <label className="mw-sell-field">
                  <span className="mw-sell-field-label">Loan Amount (₹)</span>
                  <input
                    className="mw-sell-input"
                    type="number"
                    min={0}
                    max={100000000}
                    inputMode="numeric"
                    value={loanAmount}
                    data-testid="emi-principal"
                    onChange={(event) => setLoanAmount(Math.max(0, Number(event.target.value)))}
                  />
                </label>
                <label className="mw-sell-field">
                  <span className="mw-sell-field-label">Interest Rate (% p.a.)</span>
                  <input
                    className="mw-sell-input"
                    type="number"
                    min={0}
                    max={36}
                    step={0.1}
                    value={rate}
                    data-testid="emi-rate"
                    onChange={(event) => setRate(Number(event.target.value))}
                  />
                </label>
                <label className="mw-sell-field">
                  <span className="mw-sell-field-label">Tenure</span>
                  <select
                    className="mw-sell-input"
                    value={tenure}
                    data-testid="emi-tenure"
                    onChange={(event) => setTenure(Number(event.target.value))}
                  >
                    {LOAN_TENURES.map((months) => (
                      <option key={months} value={months}>
                        {months} months
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mw-fin-emi-outputs">
                <div className="mw-fin-emi-primary">
                  <span className="mw-fin-label">Monthly EMI</span>
                  <strong data-testid="emi-monthly">{rupees(breakdown.emi)}</strong>
                  <small>
                    {tenure} months at {rate}% p.a.
                  </small>
                </div>
                <div className="mw-fin-emi-cell">
                  <span className="mw-fin-label">Principal</span>
                  <strong>{rupees(breakdown.principal)}</strong>
                </div>
                <div className="mw-fin-emi-cell">
                  <span className="mw-fin-label">Total Interest</span>
                  <strong>{rupees(breakdown.totalInterest)}</strong>
                </div>
                <div className="mw-fin-emi-cell">
                  <span className="mw-fin-label">Total Payable</span>
                  <strong>{rupees(breakdown.totalPayable)}</strong>
                </div>
              </div>
              <p className="mw-fin-note">
                Indicative calculation only — the final rate, tenure and approval are decided by the
                lending partner after document verification.
              </p>
            </div>

            {/* ------------- Step 4: compare finance options ------------- */}
            <div className="mw-fin-partners" aria-labelledby="partners-title">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> {submission.categoryLabel} finance partners
              </p>
              <h2 id="partners-title" className="mw-sell-form-title">
                Compare <span>Finance Options</span>
              </h2>
              <p className="mw-sell-form-sub">
                {submission.lowCibil && (
                  <>
                    You selected <strong>{LOW_CIBIL_RANGE}</strong> — we have opened the NBFC tab
                    first, since those partners specialise in easy approval.{" "}
                  </>
                )}
                Final rates are confirmed by each lender.
              </p>

              <div className="mw-fin-tabs" role="tablist" aria-label="Finance partner type">
                {bankLenders.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    data-testid="tab-banks"
                    aria-selected={activeTab === "banks"}
                    className={`mw-fin-tab${activeTab === "banks" ? " mw-fin-tab--active" : ""}`}
                    onClick={() => setActiveTab("banks")}
                  >
                    Banks <small>For Good CIBIL</small>
                  </button>
                )}
                <button
                  type="button"
                  role="tab"
                  data-testid="tab-nbfc"
                  aria-selected={activeTab === "nbfc"}
                  className={`mw-fin-tab${activeTab === "nbfc" ? " mw-fin-tab--active" : ""}${
                    activeTab === "nbfc" ? " mw-fin-tab--reco" : ""
                  }`}
                  onClick={() => setActiveTab("nbfc")}
                >
                  {submission.lowCibil && (
                    <span className="mw-fin-reco" data-testid="nbfc-reco">
                      Recommended
                    </span>
                  )}
                  NBFCs <small>For Low CIBIL / Easy Approval</small>
                </button>
              </div>

              {activeLenders.length > 0 ? (
                <ul className="mw-fin-grid" data-testid="lender-grid">
                  {activeLenders.map((lender) => (
                    <li key={lender.id} className="mw-fin-card" data-testid="lender-card">
                      <LenderLogo lender={lender} />
                      <div className="mw-fin-card-body">
                        <h3 data-testid="lender-name">{lender.name}</h3>
                        <span className="mw-fin-kind">
                          {lender.kind === "bank" ? "Bank" : "NBFC"}
                        </span>
                        <p>
                          {lender.kind === "bank"
                            ? "For good CIBIL — competitive rates"
                            : "Easy approval — low or no CIBIL"}
                        </p>
                      </div>
                      <BadgeCheck className="mw-fin-tick" size={16} aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mw-fin-empty" data-testid="banks-empty">
                  <p>
                    Two-wheeler loans are written by NBFCs rather than banks directly — switch to
                    the NBFC tab for the five partners that finance {category.label.toLowerCase()}.
                  </p>
                  <button
                    type="button"
                    className="mw-sell-ghost-btn"
                    onClick={() => setActiveTab("nbfc")}
                  >
                    Show NBFC partners <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* ------------- Step 5: view all partners ------------- */}
              <div className="mw-fin-all">
                <button
                  type="button"
                  className="mw-sell-ghost-btn"
                  data-testid="view-all-partners"
                  onClick={() => {
                    setPartnerQuery("");
                    setPartnersOpen(true);
                  }}
                >
                  View All Finance Partners
                  <ArrowRight size={14} />
                </button>
                <span className="mw-fin-note">
                  {ALL_LENDERS.length} banks &amp; NBFCs on the platform
                </span>
              </div>
            </div>

            <div className="mw-sell-done-actions mw-fin-actions">
              <button type="button" className="mw-sell-submit" onClick={restart}>
                Start Another Application
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
          </section>
        )}
      </main>

      {/* ---------- Step 5: full partner list, searchable ---------- */}
      <Dialog open={partnersOpen} onOpenChange={setPartnersOpen}>
        <DialogContent className="mw-fin-modal" data-testid="partners-modal">
          <DialogHeader>
            <DialogTitle className="mw-fin-modal-title">All Finance Partners</DialogTitle>
            <DialogDescription>
              Every bank and NBFC on Motor Wallah — {ALL_LENDERS.length} partners, searched by name.
            </DialogDescription>
          </DialogHeader>

          <label className="mw-fin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={partnerQuery}
              placeholder="Search partner, e.g. HDFC, Muthoot, Arman"
              aria-label="Search finance partners"
              data-testid="partner-search"
              onChange={(event) => setPartnerQuery(event.target.value)}
            />
            {partnerQuery && (
              <button
                type="button"
                className="mw-fin-search-clear"
                aria-label="Clear search"
                onClick={() => setPartnerQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>

          <ul className="mw-fin-list" data-testid="partner-list">
            {filteredPartners.map((lender) => (
              <li key={lender.id} className="mw-fin-row" data-testid="partner-row">
                <LenderLogo lender={lender} small />
                <span className="mw-fin-row-name">{lender.name}</span>
                <span className={`mw-fin-kind mw-fin-kind--${lender.kind}`}>
                  {lender.kind === "bank" ? "Bank" : "NBFC"}
                </span>
              </li>
            ))}
            {filteredPartners.length === 0 && (
              <li className="mw-fin-empty" data-testid="partner-none">
                No partner matches “{partnerQuery}”. Try a shorter name.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <SiteFooter />
      <StickyActions />
    </div>
  );
}

/**
 * Official lender artwork with the project's typographic fallback — a broken
 * or missing logo never renders, exactly like BrandArt for vehicle brands.
 */
function LenderLogo({ lender, small = false }: { lender: Lender; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = small ? "mw-fin-logo mw-fin-logo--small" : "mw-fin-logo";

  if (!lender.logo || failed) {
    return (
      <span className={`${className} mw-fin-wordmark`} aria-hidden="true">
        {lender.name
          .replace(/\s+(Bank|Finance|Financial Services|Capital|Fincorp|Services)$/i, "")
          .slice(0, 4)
          .toUpperCase()}
      </span>
    );
  }

  return (
    <span className={className}>
      <img
        src={lender.logo}
        alt={`${lender.name} logo`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
