import { useMemo, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitLead } from "@/lib/leads";
import { BRAND_NAMES, CURRENT_YEAR, modelsForBrand } from "@/lib/vehicle-catalog";
import {
  CATEGORIES,
  categoryBrands,
  categoryModels,
  getCategory,
  type CategoryId,
} from "@/lib/vehicle-categories";

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_TOPICS = [
  "Buying a vehicle",
  "Selling or exchanging",
  "Service or workshop",
  "Parts & decor order",
  "Finance",
  "Insurance",
  "RTO / documentation",
  "Warranty or roadside assistance",
  "Franchise partnership",
  "Something else",
] as const;

export function ContactForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0]);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="mw-info-success" role="status">
        <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        <strong>Message received</strong>
        <p>
          Thank you, {name.split(" ")[0] || "there"}. Our Indore team will call you on {mobile}{" "}
          within one working day. For anything urgent, call us directly.
        </p>
        <button
          type="button"
          className="mw-info-btn mw-info-btn--ghost mt-2"
          onClick={() => {
            setSent(false);
            setName("");
            setMobile("");
            setEmail("");
            setMessage("");
            setConsent(false);
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      className="mw-info-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (sending) return;
        if (name.trim().length < 2) return setError("Please enter your full name.");
        if (!MOBILE.test(mobile.trim()))
          return setError("Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
        if (email.trim() !== "" && !EMAIL.test(email.trim()))
          return setError("That email address does not look right.");
        if (message.trim().length < 10)
          return setError("Please add a few words about what you need (at least 10 characters).");
        if (!consent) return setError("Please allow us to contact you about this enquiry.");
        setError(null);
        setSending(true);
        try {
          await submitLead({
            type: "general_enquiry",
            source: "contact",
            name: name.trim(),
            mobile: mobile.trim(),
            fields: {
              topic,
              message: message.trim(),
              ...(email.trim() ? { email: email.trim() } : {}),
            },
          });
          setSent(true);
        } catch {
          setError("We could not send that just now. Please call us or try again.");
        } finally {
          setSending(false);
        }
      }}
    >
      <label className="mw-info-field">
        <span>
          Full name <em>*</em>
        </span>
        <input
          className="mw-info-input"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="mw-info-field">
        <span>
          Mobile number <em>*</em>
        </span>
        <input
          className="mw-info-input"
          name="mobile"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          placeholder="10-digit mobile"
          value={mobile}
          onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
        />
      </label>
      <label className="mw-info-field">
        <span>Email (optional)</span>
        <input
          className="mw-info-input"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="mw-info-field">
        <span>What is this about?</span>
        <select
          className="mw-info-select"
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          {CONTACT_TOPICS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="mw-info-field mw-info-field--full">
        <span>
          Your message <em>*</em>
        </span>
        <textarea
          className="mw-info-textarea"
          name="message"
          placeholder="Tell us the vehicle, booking or question you need help with."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <label className="mw-info-consent mw-info-field--full">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I agree to be contacted by Motor Wallah by phone, WhatsApp or email about this enquiry.
        </span>
      </label>
      {error ? (
        <p className="mw-info-error mw-info-field--full" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mw-info-field--full">
        <button type="submit" className="mw-info-btn mw-info-btn--primary" disabled={sending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

/** Cars are the first category and come from the car catalogue, not CATEGORIES. */
const WARRANTY_CATEGORIES = [
  { id: "cars", label: "Cars" },
  ...CATEGORIES.map((category) => ({ id: category.id, label: category.title })),
] as const;

const YEARS = Array.from({ length: CURRENT_YEAR - 2010 + 1 }, (_, index) =>
  String(CURRENT_YEAR - index),
);

const brandsIn = (category: string): string[] =>
  category === "cars" ? BRAND_NAMES : categoryBrands(getCategory(category as CategoryId));

const modelsIn = (category: string, brand: string): string[] =>
  category === "cars"
    ? modelsForBrand(brand)
    : categoryModels(getCategory(category as CategoryId), brand);

export function WarrantyLeadForm() {
  const [category, setCategory] = useState("cars");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const brands = useMemo(() => brandsIn(category), [category]);
  const models = useMemo(() => (brand ? modelsIn(category, brand) : []), [category, brand]);

  if (sent) {
    return (
      <div className="mw-info-success" role="status">
        <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        <strong>We have your details</strong>
        <p>
          Our warranty desk will check cover for your {brand} {model} ({year}) and call you on{" "}
          {mobile} — usually the same working day.
        </p>
        <button
          type="button"
          className="mw-info-btn mw-info-btn--ghost mt-2"
          onClick={() => {
            setSent(false);
            setBrand("");
            setModel("");
            setYear("");
            setName("");
            setMobile("");
          }}
        >
          Check another vehicle
        </button>
      </div>
    );
  }

  return (
    <form
      className="mw-info-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (sending) return;
        if (!brand) return setError("Select the brand of your vehicle.");
        if (!model) return setError("Select the model of your vehicle.");
        if (!year) return setError("Select the manufacturing year.");
        if (name.trim().length < 2) return setError("Please enter your full name.");
        if (!MOBILE.test(mobile.trim()))
          return setError("Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
        setError(null);
        setSending(true);
        try {
          await submitLead({
            type: "warranty_enquiry",
            source: "warranty-rsa",
            vehicleName: `${brand} ${model}`,
            name: name.trim(),
            mobile: mobile.trim(),
            fields: {
              vehicleCategory:
                WARRANTY_CATEGORIES.find((item) => item.id === category)?.label ?? "",
              brand,
              model,
              year,
            },
          });
          setSent(true);
        } catch {
          setError("We could not send that just now. Please call us or try again.");
        } finally {
          setSending(false);
        }
      }}
    >
      <label className="mw-info-field">
        <span>Vehicle category</span>
        <select
          className="mw-info-select"
          name="category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setBrand("");
            setModel("");
          }}
        >
          {WARRANTY_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mw-info-field">
        <span>
          Brand <em>*</em>
        </span>
        <select
          className="mw-info-select"
          name="brand"
          value={brand}
          onChange={(event) => {
            setBrand(event.target.value);
            setModel("");
          }}
        >
          <option value="">Select brand</option>
          {brands.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="mw-info-field">
        <span>
          Model <em>*</em>
        </span>
        <select
          className="mw-info-select"
          name="model"
          value={model}
          disabled={!brand}
          onChange={(event) => setModel(event.target.value)}
        >
          <option value="">{brand ? "Select model" : "Select a brand first"}</option>
          {models.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="mw-info-field">
        <span>
          Year <em>*</em>
        </span>
        <select
          className="mw-info-select"
          name="year"
          value={year}
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
      <label className="mw-info-field">
        <span>
          Name <em>*</em>
        </span>
        <input
          className="mw-info-input"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="mw-info-field">
        <span>
          Mobile <em>*</em>
        </span>
        <input
          className="mw-info-input"
          name="mobile"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          placeholder="10-digit mobile"
          value={mobile}
          onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
        />
      </label>
      {error ? (
        <p className="mw-info-error mw-info-field--full" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mw-info-field--full">
        <button type="submit" className="mw-info-btn mw-info-btn--primary" disabled={sending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {sending ? "Sending…" : "Check warranty & RSA cover"}
        </button>
        <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
          Cover depends on vehicle age, category and service history. No payment is taken and there
          is no obligation — we confirm eligibility before quoting.
        </p>
      </div>
    </form>
  );
}
