import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Info,
  MessageCircle,
  Phone,
  Store,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import {
  BUSINESS_AGE_OPTIONS,
  FRANCHISE_CATEGORIES,
  FRANCHISE_RESPONSE_TIME,
  FRANCHISE_STEPS,
  FRANCHISE_TYPES,
  INVESTMENT_BANDS,
  franchiseCategory,
  franchiseType,
  franchiseWhatsAppMessage,
  isFranchiseReference,
  isFranchiseTypeId,
  newFranchiseReference,
  type FranchiseCategoryId,
  type FranchiseTypeId,
} from "@/lib/franchise-flow";
import { readLeadQueue, submitLead, type Lead } from "@/lib/leads";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";
import { MAX_FILE_MB, formatSize, toUploadedFile, type UploadedFile } from "@/lib/uploads";

const TITLE = "Franchise Partnership — Dealership & Workshop | Motor Wallah";
const DESCRIPTION =
  "Partner with Motor Wallah: open a pre-owned vehicle dealership or a multi-brand workshop. Pick your franchise type, vehicle category and apply in one form.";

type FranchiseSearch = {
  type?: FranchiseTypeId | undefined;
  cat?: FranchiseCategoryId | undefined;
  ref?: string | undefined;
};

export const Route = createFileRoute("/franchise")({
  validateSearch: (search: Record<string, unknown>): FranchiseSearch => {
    const rawType = search["type"];
    const type = isFranchiseTypeId(rawType) ? rawType : undefined;
    const rawCat = search["cat"];
    const category =
      type && typeof rawCat === "string" && franchiseCategory(type, rawCat)
        ? (rawCat as FranchiseCategoryId)
        : undefined;
    const rawRef = search["ref"];
    const ref =
      typeof rawRef === "string" && isFranchiseReference(rawRef)
        ? rawRef.trim().toUpperCase()
        : undefined;
    return { type, cat: category, ref };
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

const franchiseLeads = (): Lead[] =>
  readLeadQueue().filter((lead) => lead.type === "franchise_enquiry");

const PREMISES_OPTIONS = [
  { id: "yes" as const, label: "Yes, I have the space", hint: "Showroom or workshop ready" },
  { id: "no" as const, label: "No, not yet", hint: "Still looking for a location" },
];

function Page() {
  const navigate = useNavigate();
  const { type: typeParam, cat: catParam, ref } = Route.useSearch();

  const type = franchiseType(typeParam);
  const category = franchiseCategory(type?.id, catParam);
  const step = ref ? "success" : type && category ? "form" : type ? "categories" : "types";
  const stepIndex = step === "types" ? 0 : step === "categories" ? 1 : 2;

  const [premises, setPremises] = useState<"yes" | "no" | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pendingScroll = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // A category from the other franchise type is not a valid step-3 URL.
  useEffect(() => {
    if (!catParam || !type || category) return;
    navigate({ to: "/franchise", search: { type: type.id }, replace: true });
  }, [catParam, type, category, navigate]);

  const successLead = useMemo(
    () => (ref ? franchiseLeads().find((lead) => lead.fields?.["referenceId"] === ref) : undefined),
    [ref],
  );

  const resetForm = () => {
    setPremises(null);
    setFiles([]);
    setError(null);
    setUploadError(null);
  };

  const pickType = (id: FranchiseTypeId) => {
    resetForm();
    pendingScroll.current = "franchise-categories";
    navigate({ to: "/franchise", search: { type: id } });
  };

  const pickCategory = (categoryId: FranchiseCategoryId) => {
    if (!type) return;
    resetForm();
    pendingScroll.current = "franchise-application";
    navigate({ to: "/franchise", search: { type: type.id, cat: categoryId } });
  };

  const backToTypes = () => {
    resetForm();
    pendingScroll.current = "franchise-types";
    navigate({ to: "/franchise", search: {} });
  };

  const backToCategories = () => {
    resetForm();
    pendingScroll.current = "franchise-categories";
    navigate({ to: "/franchise", search: { type: type?.id } });
  };

  const startOver = () => {
    resetForm();
    pendingScroll.current = "franchise-types";
    navigate({ to: "/franchise", search: {} });
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploadError(null);
    setError(null);
    try {
      const added: UploadedFile[] = [];
      for (const file of Array.from(list).slice(0, 3)) {
        added.push(await toUploadedFile(file, "GST Certificate / Shop License"));
      }
      setFiles((prev) => [...prev, ...added].slice(0, 3));
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error ? uploadFailure.message : "Could not read that file.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!type || !category) return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();

    const name = read("name").slice(0, 80);
    const rawMobile = read("mobile").replace(/\D/g, "");
    const mobile =
      rawMobile.length === 12 && rawMobile.startsWith("91") ? rawMobile.slice(2) : rawMobile;
    const email = read("email").slice(0, 120);
    const city = read("city").slice(0, 60);
    const business = read("business").slice(0, 120);
    const years = read("years");
    const space = read("space");
    const investment = read("investment");

    let message: string | null = null;
    if (name.length < 2) message = "Please enter your full name.";
    else if (!/^[6-9]\d{9}$/.test(mobile)) message = "Enter a valid 10-digit Indian mobile number.";
    else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) message = "Enter a valid email address.";
    else if (city.length < 2) message = "Tell us which city you want to open in.";
    else if (business.length < 2) message = "Enter your business name.";
    else if (!BUSINESS_AGE_OPTIONS.includes(years as (typeof BUSINESS_AGE_OPTIONS)[number]))
      message = "Select how long you have been in business.";
    else if (!premises) message = "Tell us whether you already have a showroom or workshop space.";
    else if (!(Number(space) > 0) || Number(space) > 1_000_000)
      message = "Enter the available space in square feet.";
    else if (!INVESTMENT_BANDS.includes(investment as (typeof INVESTMENT_BANDS)[number]))
      message = "Select your investment capacity.";
    else if (!files.length) message = "Upload your GST certificate or shop license.";

    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setSubmitting(true);

    const referenceId = newFranchiseReference(
      franchiseLeads().map((lead) => lead.fields?.["referenceId"] ?? ""),
    );

    await submitLead({
      type: "franchise_enquiry",
      source: "franchise",
      name,
      mobile,
      documents: files,
      fields: {
        referenceId,
        franchiseTypeId: type.id,
        franchiseType: type.title,
        categoryId: category.id,
        category: category.label,
        email,
        city,
        businessName: business,
        yearsInBusiness: years,
        premises: premises === "yes" ? "Yes" : "No",
        spaceSqFt: space,
        investmentCapacity: investment,
        documents: String(files.length),
        name,
        mobile,
      },
    });

    setSubmitting(false);
    resetForm();
    pendingScroll.current = "franchise-success";
    navigate({
      to: "/franchise",
      search: { type: type.id, cat: category.id, ref: referenceId },
    });
  };

  const copyReference = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the ID is on screen anyway */
    }
  };

  const successFields = successLead?.fields ?? {};
  const summary: { label: string; value: string }[] = [
    {
      label: "Partnership",
      value: successFields["franchiseType"] ?? type?.title ?? "—",
    },
    { label: "Category", value: successFields["category"] ?? category?.label ?? "—" },
    { label: "City", value: successFields["city"] ?? "—" },
    { label: "Business", value: successFields["businessName"] ?? "—" },
    { label: "Investment", value: successFields["investmentCapacity"] ?? "—" },
    {
      label: "Premises",
      value:
        successFields["premises"] === "Yes"
          ? `Yes · ${successFields["spaceSqFt"] ?? "—"} sq ft`
          : (successFields["premises"] ?? "—"),
    },
    {
      label: "Documents",
      value: successFields["documents"] ? `${successFields["documents"]} uploaded` : "—",
    },
    { label: "Mobile", value: successLead?.mobile ?? "—" },
  ];

  return (
    <div id="top" className="mw-sell mw-fr min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Franchise · Motor Wallah partnership
            </p>
            <h1 className="mw-sell-hero-title">
              Franchise <em>Partnership</em>
            </h1>
            <p className="mw-sell-hero-text">
              Choose the partnership you want to run, tell us which vehicles you will handle, and
              send one application. Our partnership team reviews it and gets in touch within{" "}
              {FRANCHISE_RESPONSE_TIME}.
            </p>
            <div className="mw-sell-hero-actions">
              <a
                className="mw-sell-ghost-btn"
                href={whatsappLink(
                  "Hi Motor Wallah, I want to know more about the franchise opportunity.",
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Franchise flow steps">
              {FRANCHISE_STEPS.map((label, index) => (
                <span
                  key={label}
                  data-testid="franchise-step"
                  className={`mw-sell-step${index === stepIndex ? " mw-sell-step--active" : ""}`}
                >
                  {index + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Step 1: main franchise type ---------------- */}
        {step === "types" && (
          <section id="franchise-types" className="mw-sell-section">
            <div className="home-container">
              <div className="mw-fr-head">
                <p className="mw-sell-kicker">Step 1 · Franchise type</p>
                <h2 className="mw-sell-title">
                  How do you want to <span>partner?</span>
                </h2>
                <p className="mw-sell-text">
                  Two ways to run a Motor Wallah business. Pick one to see the vehicle categories
                  available for that setup.
                </p>
              </div>

              <div className="mw-fr-types">
                {FRANCHISE_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mw-fr-type"
                    data-testid="franchise-type"
                    data-type={item.id}
                    onClick={() => pickType(item.id)}
                  >
                    <span className="mw-fr-type-icon" aria-hidden="true">
                      {item.id === "dealership" ? <Store size={26} /> : <Wrench size={26} />}
                    </span>
                    <span className="mw-fr-type-kicker">{item.kicker}</span>
                    <h3 className="mw-fr-type-title">{item.title}</h3>
                    <span className="mw-fr-type-text">{item.blurb}</span>
                    <ul className="mw-fr-type-list">
                      {item.highlights.map((highlight) => (
                        <li key={highlight}>
                          <Check size={14} aria-hidden="true" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="mw-fr-type-cta">
                      {item.cta} <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>

              <p className="mw-fr-note">
                <Info size={14} aria-hidden="true" />
                <span>
                  Investment, space and documents are reviewed by our partnership team before any
                  agreement is signed.
                </span>
              </p>
            </div>
          </section>
        )}

        {/* ---------------- Step 2: category grid ---------------- */}
        {step === "categories" && type && (
          <section id="franchise-categories" className="mw-sell-section">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToTypes}>
                  <ArrowLeft size={14} /> Change franchise type
                </button>
                <span className="mw-sell-chip">
                  {type.id === "dealership" ? <Store size={15} /> : <Wrench size={15} />}
                  <span>{type.title}</span>
                </span>
              </div>

              <div className="mw-fr-head">
                <p className="mw-sell-kicker">Step 2 · Vehicle category</p>
                <h2 className="mw-sell-title">
                  Which vehicles will you <span>handle?</span>
                </h2>
                <p className="mw-sell-text">
                  Pick the category you want to start with. You can add more categories to the same
                  franchise later.
                </p>
              </div>

              <div className="mw-fr-cats">
                {FRANCHISE_CATEGORIES[type.id].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="mw-fr-cat"
                    data-testid="franchise-category"
                    data-category={item.id}
                    onClick={() => pickCategory(item.id)}
                  >
                    <span className="mw-fr-cat-media">
                      <img
                        src={item.image}
                        alt={`${item.label} illustrative photograph`}
                        width={480}
                        height={300}
                        loading="lazy"
                      />
                      {item.isNew && <span className="mw-fr-new">New</span>}
                    </span>
                    <span className="mw-fr-cat-body">
                      <span className="mw-fr-cat-name">{item.label}</span>
                      <span className="mw-fr-cat-blurb">{item.blurb}</span>
                    </span>
                    <span className="mw-fr-cat-arrow" aria-hidden="true">
                      <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>

              {type.id === "workshop" && (
                <p className="mw-fr-note">
                  <Info size={14} aria-hidden="true" />
                  <span>
                    Taxi and commercial cars are serviced inside the Cars workshop, so they are not
                    a separate workshop category.
                  </span>
                </p>
              )}
            </div>
          </section>
        )}

        {/* ---------------- Step 3: application form ---------------- */}
        {step === "form" && type && category && (
          <section
            id="franchise-application"
            className="mw-sell-form-section"
            aria-labelledby="franchise-form-title"
            data-testid="franchise-application"
          >
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    {type.id === "dealership" ? "Dealership" : "Workshop"} ·{" "}
                    <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <form
                className="mw-sell-form"
                onSubmit={onSubmit}
                onChange={() => setError(null)}
                noValidate
              >
                <h2 id="franchise-form-title" className="mw-sell-form-title">
                  Franchise <span>Application</span>
                </h2>
                <p className="mw-sell-form-sub">
                  {type.title} · {category.label}. Fields marked * are required.
                </p>

                <div className="mw-fr-block">
                  <h3 className="mw-fr-block-title">Personal details</h3>
                  <div className="mw-sell-fields">
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Full Name *</span>
                      <input
                        name="name"
                        required
                        maxLength={80}
                        autoComplete="name"
                        className="mw-sell-input"
                        data-testid="full-name"
                        placeholder="Your full name"
                      />
                    </label>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Mobile *</span>
                      <input
                        name="mobile"
                        required
                        inputMode="numeric"
                        maxLength={15}
                        autoComplete="tel"
                        className="mw-sell-input"
                        data-testid="mobile"
                        placeholder="10-digit mobile number"
                      />
                    </label>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Email *</span>
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={120}
                        autoComplete="email"
                        className="mw-sell-input"
                        data-testid="email"
                        placeholder="you@example.com"
                      />
                    </label>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">City *</span>
                      <input
                        name="city"
                        required
                        maxLength={60}
                        className="mw-sell-input"
                        data-testid="city"
                        placeholder="Where do you want to open?"
                      />
                    </label>
                  </div>
                </div>

                <div className="mw-fr-block">
                  <h3 className="mw-fr-block-title">Business details</h3>
                  <div className="mw-sell-fields">
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Business Name *</span>
                      <input
                        name="business"
                        required
                        maxLength={120}
                        className="mw-sell-input"
                        data-testid="business-name"
                        placeholder="Registered business or firm name"
                      />
                    </label>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Years in Business *</span>
                      <select
                        name="years"
                        required
                        defaultValue=""
                        className="mw-sell-input"
                        data-testid="years-in-business"
                      >
                        <option value="">Select experience</option>
                        {BUSINESS_AGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mw-fr-block">
                  <h3 className="mw-fr-block-title">Infrastructure</h3>
                  <div className="mw-sell-fields">
                    <div className="mw-sell-field mw-sell-field--full">
                      <span className="mw-sell-field-label">
                        Do you have a physical showroom / workshop? *
                      </span>
                      <div className="mw-fr-seg" role="group" aria-label="Physical premises">
                        {PREMISES_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            data-testid={`premises-${option.id}`}
                            aria-pressed={premises === option.id}
                            className={`mw-fr-seg-btn${
                              premises === option.id ? " mw-fr-seg-btn--active" : ""
                            }`}
                            onClick={() => {
                              setPremises(option.id);
                              setError(null);
                            }}
                          >
                            {option.label}
                            <small>{option.hint}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Space in Sq Ft *</span>
                      <input
                        name="space"
                        type="number"
                        required
                        min={100}
                        max={1_000_000}
                        step={50}
                        inputMode="numeric"
                        className="mw-sell-input"
                        data-testid="space-sqft"
                        placeholder="e.g. 2500"
                      />
                    </label>
                    <label className="mw-sell-field">
                      <span className="mw-sell-field-label">Investment Capacity *</span>
                      <select
                        name="investment"
                        required
                        defaultValue=""
                        className="mw-sell-input"
                        data-testid="investment-capacity"
                      >
                        <option value="">Select investment</option>
                        {INVESTMENT_BANDS.map((band) => (
                          <option key={band} value={band}>
                            {band}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mw-fr-block">
                  <h3 className="mw-fr-block-title">Documents</h3>
                  <div className="mw-sell-field">
                    <span className="mw-sell-field-label">GST Certificate / Shop License *</span>
                    <label className="mw-fr-upload">
                      <Upload size={18} aria-hidden="true" />
                      <span className="mw-fr-upload-text">
                        <strong>Upload GST Certificate or Shop License</strong>
                        <small>PDF, JPG or PNG · up to {MAX_FILE_MB} MB · max 3 files</small>
                      </span>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className="mw-fr-file-input"
                        data-testid="document-upload"
                        onChange={(event) => void addFiles(event.target.files)}
                      />
                    </label>
                    {files.length > 0 && (
                      <ul className="mw-fr-files">
                        {files.map((file) => (
                          <li key={file.id}>
                            <FileText size={14} aria-hidden="true" />
                            <span className="mw-fr-file-name">{file.name}</span>
                            <small>{formatSize(file.size)}</small>
                            <button
                              type="button"
                              aria-label={`Remove ${file.name}`}
                              data-testid="remove-document"
                              onClick={() =>
                                setFiles((prev) => prev.filter((item) => item.id !== file.id))
                              }
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {uploadError && (
                      <p className="mw-sell-error" role="alert">
                        {uploadError}
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="mw-sell-error" role="alert" data-testid="application-error">
                    {error}
                  </p>
                )}

                <div className="mw-sell-form-foot">
                  <button
                    type="submit"
                    className="mw-sell-submit"
                    disabled={submitting}
                    data-testid="submit-application"
                  >
                    {submitting ? "Submitting…" : "Submit Application"} <ArrowRight size={16} />
                  </button>
                  <p className="mw-sell-form-note">
                    Your details are shared only with the Motor Wallah partnership team, and used to
                    review this application.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Step 4: success ---------------- */}
        {step === "success" && (
          <section id="franchise-success" className="home-container mw-sell-done mw-fr-done">
            <div data-testid="franchise-success">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">Application Received</h2>
              <p className="mw-sell-done-text">
                Thank you! Your interest is received. Our partnership team will contact you within{" "}
                {FRANCHISE_RESPONSE_TIME}.
              </p>

              <div className="mw-fr-ref">
                <span className="mw-fr-ref-label">Your Reference ID</span>
                <strong className="mw-fr-ref-value" data-testid="reference-id">
                  {ref}
                </strong>
                <button
                  type="button"
                  className="mw-fr-ref-copy"
                  onClick={() => ref && copyReference(ref)}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
                  {copied ? "Copied" : "Copy ID"}
                </button>
              </div>

              <div className="mw-fr-summary" data-testid="application-summary">
                {summary.map((cell) => (
                  <div key={cell.label} className="mw-fr-summary-cell">
                    <span>{cell.label}</span>
                    <strong>{cell.value}</strong>
                  </div>
                ))}
              </div>

              <div className="mw-fr-actions">
                <a
                  className="mw-sell-submit"
                  href={whatsappLink(franchiseWhatsAppMessage(ref ?? ""))}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="whatsapp-partnership"
                >
                  <MessageCircle size={15} /> Talk to the Partnership Team
                </a>
                <button
                  type="button"
                  className="mw-sell-ghost-btn"
                  onClick={startOver}
                  data-testid="start-over"
                >
                  Start Another Application
                </button>
              </div>

              <p className="mw-fr-note mw-fr-note--center">
                <Clock size={14} aria-hidden="true" />
                <span>
                  Keep this Reference ID — quote it in any call or WhatsApp message about your
                  application.
                </span>
              </p>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
