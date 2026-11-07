/**
 * Resend email alerts (server only).
 *
 * Every function here runs on the server: the module is imported by the
 * `/api/send-email` server route and the `/api/orders` route, never by a page,
 * so the API key cannot reach the browser bundle.
 *
 * Sending is best-effort by design. A form submission or a paid order has
 * already been stored by the time an email is attempted, so nothing in this
 * file throws: a Resend outage returns `{ ok: false }` and the caller carries
 * on. Nothing here ever blocks a customer action.
 *
 * Resend's REST API is called with `fetch` rather than their SDK: one JSON POST
 * needs no dependency, and the fetch runs in whatever runtime serves the app.
 */

/** The address emails are sent from until motorwallah.com is verified in Resend. */
const DEFAULT_FROM = "Motor Wallah <onboarding@resend.dev>";

/** Where internal lead/order alerts go. Override with ADMIN_ALERT_EMAIL. */
const DEFAULT_ADMIN = "admin@motorwallah.com";

type Env = { apiKey: string; from: string; admin: string };

/**
 * Dev servers and plain Node processes do not read `.env.local` into
 * `process.env`, so load it lazily on the server (same approach as
 * `src/lib/payments.ts`). A deployment's injected values always win because
 * they are already in `process.env`.
 */
function loadLocalEnv(): void {
  if (typeof process === "undefined" || typeof process.loadEnvFile !== "function") return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* file absent — the deployment supplies real environment variables */
    }
  }
}

function readEnv(): Env {
  const env = (typeof process !== "undefined" ? process.env : {}) as Record<
    string,
    string | undefined
  >;
  const read = () => ({
    apiKey: (env["RESEND_API_KEY"] ?? "").trim(),
    from: (env["EMAIL_FROM"] ?? "").trim() || DEFAULT_FROM,
    admin: (env["ADMIN_ALERT_EMAIL"] ?? "").trim() || DEFAULT_ADMIN,
  });

  const current = read();
  if (current.apiKey) return current;
  loadLocalEnv();
  return read();
}

/** A key left in the file as a placeholder must never be sent to Resend. */
function isPlaceholderKey(key: string): boolean {
  return key === "" || /^YOUR_|_HERE$|^re_xxxx/i.test(key);
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; code: "not_configured" | "rejected" | "network"; message: string };

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | undefined;
};

function endpoint(): string {
  const base =
    (typeof process !== "undefined" && process.env["RESEND_API_BASE"]) || "https://api.resend.com";
  return `${base.replace(/\/+$/, "")}/emails`;
}

/** One Resend call. Never throws; the reason is in the result. */
export async function sendEmail(message: Message): Promise<SendResult> {
  const { apiKey, from } = readEnv();
  if (isPlaceholderKey(apiKey)) {
    return {
      ok: false,
      code: "not_configured",
      message: "RESEND_API_KEY is not set on the server, so no email was sent.",
    };
  }

  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;

    if (!response.ok || !body?.id) {
      return {
        ok: false,
        code: "rejected",
        message:
          body?.message ??
          `${body?.name ?? "Resend"} rejected the message (HTTP ${response.status}).`,
      };
    }

    return { ok: true, id: body.id };
  } catch {
    return { ok: false, code: "network", message: "Could not reach Resend." };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rupees = (amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

/** Shared shell: a red rule, the wordmark, the content, a quiet footer. */
function layout(options: {
  heading: string;
  intro: string;
  rows: [string, string][];
  note?: string;
}) {
  const rows = options.rows
    .filter(([, value]) => value !== "")
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;width:38%">${escapeHtml(label)}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f6f8;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e9eaee">
    <tr><td style="padding:22px 26px 6px">
      <div style="font-size:12px;letter-spacing:2px;color:#d81f26;font-weight:700">MOTOR WALLAH</div>
      <h1 style="margin:10px 0 6px;font-size:21px;line-height:1.25;color:#111827">${escapeHtml(options.heading)}</h1>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4b5563">${escapeHtml(options.intro)}</p>
    </td></tr>
    <tr><td style="padding:0 26px 8px">
      <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
    </td></tr>
    ${
      options.note
        ? `<tr><td style="padding:2px 26px 8px">
      <p style="margin:0;padding:12px 14px;background:#fdf2f2;border-left:3px solid #d81f26;border-radius:8px;font-size:13px;line-height:1.6;color:#374151">${escapeHtml(options.note)}</p>
    </td></tr>`
        : ""
    }
    <tr><td style="padding:14px 26px 24px">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">Motor Wallah · Drive trust. Drive quality.<br/>This message was sent automatically; reply to it and our team will pick it up.</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    options.heading,
    "",
    options.intro,
    "",
    ...options.rows
      .filter(([, value]) => value !== "")
      .map(([label, value]) => `${label}: ${value}`),
    ...(options.note ? ["", options.note] : []),
    "",
    "Motor Wallah · Drive trust. Drive quality.",
  ].join("\n");

  return { html, text };
}

/** The kind of form a customer filled in, phrased for an email subject line. */
const FORM_LABELS: Record<string, string> = {
  finance_enquiry: "Finance application",
  insurance_enquiry: "Insurance quote request",
  service_booking: "Service booking",
  sell_car: "Sell your car request",
  sell_vehicle: "Sell your vehicle request",
  franchise_enquiry: "Franchise application",
  parts_enquiry: "Parts order",
  decor_order: "Decor order",
};

export const formLabel = (type: string): string => FORM_LABELS[type] ?? "Enquiry";

/** `investmentCapacity` / `ncB_range` -> "Investment capacity" / "Ncb range". */
const prettyLabel = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());

export type FormEmailInput = {
  /** Lead type, e.g. `finance_enquiry`. */
  type: string;
  source: string;
  name?: string | undefined;
  mobile?: string | undefined;
  email?: string | undefined;
  vehicleName?: string | undefined;
  /** Short reference the customer can quote (tracking id, application id). */
  reference?: string | undefined;
  /** Extra labelled details for the internal alert. */
  details?: [string, string][] | undefined;
};

/**
 * The customer's "thank you" (only when they left an email) and the internal
 * alert to the admin. Both are attempted independently: one failing must not
 * stop the other, and neither affects the submission that already happened.
 */
export async function sendFormEmails(input: FormEmailInput): Promise<SendResult[]> {
  const { admin } = readEnv();
  const label = formLabel(input.type);
  const rows: [string, string][] = [
    ["Name", input.name ?? ""],
    ["Mobile", input.mobile ?? ""],
    ["Email", input.email ?? ""],
    ["Vehicle", input.vehicleName ?? ""],
    ["Reference", input.reference ?? ""],
    ...(input.details ?? []).map(([key, value]): [string, string] => [prettyLabel(key), value]),
    ["Source page", input.source],
  ];

  const jobs: Promise<SendResult>[] = [];

  if (input.email) {
    const body = layout({
      heading: `Thank you, ${input.name || "there"}`,
      intro: `We have your ${label.toLowerCase()}. A Motor Wallah specialist will call you on ${
        input.mobile || "the number you gave us"
      } shortly.`,
      rows: rows.filter(([rowLabel]) => !["Source page", "Email"].includes(rowLabel)),
      note: input.reference
        ? `Quote reference ${input.reference} if you call us about this.`
        : "No action needed from you right now.",
    });
    jobs.push(
      sendEmail({
        to: input.email,
        subject: `We received your ${label.toLowerCase()}${input.reference ? ` · ${input.reference}` : ""}`,
        ...body,
      }),
    );
  }

  const alert = layout({
    heading: `New ${label.toLowerCase()}`,
    intro: input.reference
      ? `Reference ${input.reference}. Reach out within the callback window.`
      : "No reference on this lead. Reach out within the callback window.",
    rows,
  });
  jobs.push(
    sendEmail({
      to: admin,
      subject: `[Motor Wallah] ${label}${input.name ? ` — ${input.name}` : ""}`,
      replyTo: input.email,
      ...alert,
    }),
  );

  return Promise.all(jobs);
}

export type OrderEmailInput = {
  orderRef: string;
  itemType: string;
  total: number;
  currency?: string | undefined;
  name?: string | undefined;
  mobile?: string | undefined;
  email?: string | undefined;
  city?: string | undefined;
  items: { name: string; quantity: number; price: number }[];
  notes?: string | undefined;
};

/** Order confirmation for the customer plus a copy for the admin inbox. */
export async function sendOrderEmails(input: OrderEmailInput): Promise<SendResult[]> {
  const { admin } = readEnv();
  const total = rupees(input.total);
  const itemSummary = input.items
    .map(
      (item) => `${item.quantity} × ${item.name || "Item"} (${rupees(item.price * item.quantity)})`,
    )
    .join("; ");

  const rows: [string, string][] = [
    ["Order reference", input.orderRef],
    ["Total paid", total],
    ["Type", input.itemType === "decor" ? "Vehicle decor" : "Auto parts"],
    ["Items", itemSummary],
    ["Name", input.name ?? ""],
    ["Mobile", input.mobile ?? ""],
    ["Email", input.email ?? ""],
    ["Deliver to", input.city ?? ""],
    ["Payment", input.notes ?? ""],
  ];

  const jobs: Promise<SendResult>[] = [];

  if (input.email) {
    const body = layout({
      heading: "Order confirmed",
      intro: `Thanks ${input.name || "for your order"} — payment is received and your ${input.itemType === "decor" ? "decor" : "parts"} are being prepared for dispatch.`,
      rows: rows.filter(([rowLabel]) => rowLabel !== "Email"),
      note: `Keep reference ${input.orderRef} handy. It is what we quote on any call about this order.`,
    });
    jobs.push(
      sendEmail({
        to: input.email,
        subject: `Order confirmed · ${input.orderRef} · ${total}`,
        ...body,
      }),
    );
  }

  const alert = layout({
    heading: `New ${input.itemType} order`,
    intro: `${total} paid. Prepare the dispatch once the payment is visible in the gateway.`,
    rows,
  });
  jobs.push(
    sendEmail({
      to: admin,
      subject: `[Motor Wallah] Order ${input.orderRef} — ${total}`,
      replyTo: input.email,
      ...alert,
    }),
  );

  return Promise.all(jobs);
}

/** Whether the server has a usable key, for the route's readiness response. */
export function emailConfigured(): boolean {
  return !isPlaceholderKey(readEnv().apiKey);
}
