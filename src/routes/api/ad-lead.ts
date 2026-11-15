/**
 * POST /api/ad-lead — notify the advertiser about a captured ad enquiry.
 *
 * The lead itself is already stored in `ad_leads` by the browser before this
 * request is made, so this endpoint never fails the customer's form. It:
 *
 *   1. re-reads the banner row from Supabase, so the recipient address always
 *      comes from the database rather than from the request (no open relay);
 *   2. emails the advertiser and the admin inbox through Resend;
 *   3. sends a WhatsApp message through the WhatsApp Cloud API when the server
 *      has WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID configured.
 *
 * Without WhatsApp credentials the endpoint reports `not_configured` instead of
 * pretending the message went out; the Ad Leads tab always offers a one-click
 * WhatsApp forward so the lead can still reach the advertiser.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { apiError, json, methodNotAllowed, preflight, readJson } from "@/lib/api/http";
import { sendAdLeadEmails, serverEnv } from "@/lib/email";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";
import { sectionLabel } from "@/lib/ad-leads";

const schema = z.object({
  section: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(8).max(20),
  requirement: z.string().trim().max(1000),
  sourcePath: z.string().trim().max(300).optional(),
});

type BannerContact = {
  title: string | null;
  advertiser_name: string | null;
  advertiser_email: string | null;
  advertiser_whatsapp: string | null;
};

/** Read the advertiser from the publicly readable banners row. */
async function bannerContact(section: string): Promise<BannerContact | null> {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/banners`);
    url.searchParams.set("section", `eq.${section}`);
    url.searchParams.set("select", "title,advertiser_name,advertiser_email,advertiser_whatsapp");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as BannerContact[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

type WhatsAppResult = { sent: boolean; detail: string };

/**
 * Business-initiated WhatsApp messages need an approved template, so the
 * template name/language are configuration. With a template configured the four
 * body parameters are name, mobile, requirement and ad slot; without one the
 * message is sent as plain text (only deliverable inside an open 24-hour
 * conversation window).
 */
async function sendWhatsApp(input: {
  to: string;
  name: string;
  mobile: string;
  requirement: string;
  label: string;
}): Promise<WhatsAppResult> {
  const token = serverEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = serverEnv("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    return {
      sent: false,
      detail:
        "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set on the server, so no WhatsApp message was sent.",
    };
  }

  const to = input.to.replace(/\D/g, "");
  if (!to) return { sent: false, detail: "The advertiser has no WhatsApp number." };
  const recipient = to.length === 10 ? `91${to}` : to;

  const template = serverEnv("WHATSAPP_TEMPLATE_NAME");
  const language = serverEnv("WHATSAPP_TEMPLATE_LANGUAGE") || "en";
  const body = template
    ? {
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: input.name },
                { type: "text", text: input.mobile },
                { type: "text", text: input.requirement || "Not specified" },
                { type: "text", text: input.label },
              ],
            },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: {
          body: [
            `New Motor Wallah enquiry for "${input.label}".`,
            `Name: ${input.name}`,
            `Mobile: ${input.mobile}`,
            input.requirement ? `Requirement: ${input.requirement}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        detail: `WhatsApp rejected the message (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}.`,
      };
    }
    return { sent: true, detail: "WhatsApp message sent." };
  } catch {
    return { sent: false, detail: "Could not reach the WhatsApp API." };
  }
}

/**
 * A public endpoint that can send mail and WhatsApp messages needs a ceiling.
 * Eight enquiries per address per ten minutes is far above a real visitor.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
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
  if (recent.size > 500) {
    for (const [entry, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(entry);
    }
  }
  return false;
}

export const Route = createFileRoute("/api/ad-lead")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (throttled(ip)) {
          return apiError(
            "conflict",
            "Too many enquiries from this device. Wait a few minutes and try again.",
          );
        }

        const body = await readJson(request);
        if (!body.ok) return body.response;

        const parsed = schema.safeParse(body.value);
        if (!parsed.success) {
          return apiError("bad_request", "The enquiry payload is not valid.", {
            type: parsed.error.issues.map((issue) => issue.message),
          });
        }
        const input = parsed.data;

        const contact = await bannerContact(input.section);
        const label = contact?.title?.trim() || sectionLabel(input.section);

        const [emails, whatsapp] = await Promise.all([
          sendAdLeadEmails({
            section: input.section,
            sectionLabel: label,
            bannerTitle: contact?.title ?? "",
            advertiserName: contact?.advertiser_name ?? "",
            advertiserEmail: contact?.advertiser_email ?? "",
            name: input.name,
            mobile: input.mobile,
            requirement: input.requirement,
            sourcePath: input.sourcePath ?? "",
          }),
          contact?.advertiser_whatsapp
            ? sendWhatsApp({
                to: contact.advertiser_whatsapp,
                name: input.name,
                mobile: input.mobile,
                requirement: input.requirement,
                label,
              })
            : Promise.resolve<WhatsAppResult>({
                sent: false,
                detail: "This banner has no advertiser WhatsApp number.",
              }),
        ]);

        const delivered = emails.filter((result) => result.ok).length;
        return json({
          data: {
            emailsSent: delivered,
            emailsAttempted: emails.length,
            whatsapp,
            advertiserEmail: Boolean(contact?.advertiser_email),
            advertiserWhatsapp: Boolean(contact?.advertiser_whatsapp),
          },
        });
      },

      GET: () => methodNotAllowed(["POST"]),
    },
  },
});
