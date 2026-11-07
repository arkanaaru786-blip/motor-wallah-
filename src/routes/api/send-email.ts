/**
 * POST /api/send-email — form submission alerts.
 *
 * Called by the browser right after a lead is stored (`submitLead` in
 * `src/lib/leads.ts`), fire-and-forget: the form has already succeeded by the
 * time this request leaves, so a slow or failing email never blocks it.
 *
 *   { "type": "finance_enquiry", "source": "finance", "name": "…", "mobile": "…",
 *     "email": "…", "vehicleName": "…", "reference": "MW-…",
 *     "details": { "CIBIL range": "750+" } }
 *
 * The route sends a thank-you to the customer when they left an email, and an
 * internal alert to ADMIN_ALERT_EMAIL. It answers `202` with what happened
 * rather than failing the caller: email is a notification, not the submission.
 *
 * Orders send their own confirmation from `POST /api/orders`, where the caller
 * is authenticated — this endpoint deliberately does not accept order payloads.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { apiError, json, methodNotAllowed, preflight, readJson } from "@/lib/api/http";
import { emailConfigured, formLabel, sendFormEmails } from "@/lib/email";

/** Only the forms that must trigger mail can be asked for. */
const ALERT_TYPES = [
  "finance_enquiry",
  "insurance_enquiry",
  "service_booking",
  "sell_car",
  "sell_vehicle",
  "franchise_enquiry",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional();

const formAlertSchema = z.object({
  type: z.enum(ALERT_TYPES),
  source: z.string().trim().min(1).max(60),
  name: optionalText(120),
  mobile: optionalText(20),
  email: z.string().trim().email("Enter a valid email address").max(200).optional(),
  vehicleName: optionalText(160),
  reference: optionalText(60),
  /** A handful of labelled details for the internal alert only. */
  details: z.record(z.string().trim().max(60), z.string().trim().max(300)).optional(),
});

/**
 * A public endpoint that sends mail needs a ceiling. Five alerts per address
 * per ten minutes is far above a real customer's pace and far below a useful
 * spam rate. The window lives in this process's memory, which is enough for the
 * single Node/Workers instance that serves the site.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  // Keep the map from growing without bound on a long-lived process.
  if (recent.size > 500) {
    for (const [entry, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(entry);
    }
  }
  return false;
}

export const Route = createFileRoute("/api/send-email")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      POST: async ({ request }) => {
        // Behind the dev proxy and Cloudflare the client address is forwarded.
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (throttled(ip)) {
          return apiError(
            "conflict",
            "Too many email alerts from this device. Wait a few minutes and try again.",
          );
        }

        const body = await readJson(request);
        if (!body.ok) return body.response;

        const parsed = formAlertSchema.safeParse(body.value);
        if (!parsed.success) {
          return apiError("bad_request", "The email alert payload is not valid.", {
            type: parsed.error.issues.map((issue) => issue.message),
          });
        }
        const input = parsed.data;

        const results = await sendFormEmails({
          type: input.type,
          source: input.source,
          name: input.name,
          mobile: input.mobile,
          email: input.email,
          vehicleName: input.vehicleName,
          reference: input.reference,
          details: Object.entries(input.details ?? {}).slice(0, 12),
        });

        const sent = results.filter((result) => result.ok).length;
        return json(
          {
            data: {
              form: formLabel(input.type),
              attempted: results.length,
              sent,
              configured: emailConfigured(),
              // Safe to log: these are Resend's own reasons, never the API key.
              problems: results.flatMap((result) => (result.ok ? [] : [result.message])),
            },
          },
          202,
        );
      },

      GET: () => methodNotAllowed(["POST", "OPTIONS"]),
    },
  },
});
