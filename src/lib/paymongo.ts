import { createHmac, timingSafeEqual } from "node:crypto";
import { PRO_PASS_PRICE_CENTAVOS } from "@/lib/constants";

const API_BASE = "https://api.paymongo.com/v1";

export function isPaymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set.");
  // PayMongo uses HTTP Basic Auth: secret key as username, empty password.
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

interface PaymongoResource<TAttributes> {
  data: {
    id: string;
    type: string;
    attributes: TAttributes;
  };
}

// Outbound calls to PayMongo must never hang the request indefinitely — a
// slow/blackholed connection would otherwise block the webhook handler or
// leave a user's browser spinning on "Redirecting…" forever.
const OUTBOUND_TIMEOUT_MS = 10_000;

/**
 * True if `error` came from an outbound fetch aborting because it exceeded
 * `OUTBOUND_TIMEOUT_MS` (via `AbortSignal.timeout()`). Cross-runtime this
 * surfaces as a DOMException/Error named "TimeoutError" (per the WHATWG
 * spec for AbortSignal.timeout) — some environments report "AbortError"
 * instead, so both are treated the same at call sites.
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

interface PaymongoPaymentAttributes {
  amount: number; // in the currency's smallest unit (centavos for PHP)
  currency: string; // e.g. "PHP"
  status: string; // e.g. "paid", "failed"
}

interface PaymongoPayment {
  id: string;
  type: string;
  attributes: PaymongoPaymentAttributes;
}

// Checkout Session resource shape, inferred from the `payments`/`payment_intent`
// nested resources (PayMongo's docs site had several 404s mid-restructure
// when this was built — see verifyPaymongoWebhook's docstring for the same
// caveat on the signature algorithm). `payments` holds Payment resource
// objects once a session has been paid; that's the only authoritative
// record of what was actually captured — the event type alone isn't enough
// (see getCheckoutSessionDetails).
interface CheckoutSessionAttributes {
  checkout_url: string;
  metadata: Record<string, string> | null;
  payments: PaymongoPayment[] | null;
}

export async function createProCheckoutSession(input: {
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: "POST",
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: "TranslateThis Pro — 30-day pass",
              amount: PRO_PASS_PRICE_CENTAVOS,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["card", "gcash", "paymaya"],
          customer_email: input.email,
          description: "Unlimited translations for 30 days",
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: false,
          // Read back in the webhook via getCheckoutSessionDetails() to know
          // which user to grant Pro to — see /api/paymongo/webhook.
          metadata: { userId: input.userId, email: input.email },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayMongo checkout session creation failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as PaymongoResource<CheckoutSessionAttributes>;
  return json.data.attributes.checkout_url;
}

export interface CheckoutSessionDetails {
  metadata: Record<string, string> | null;
  /** Amount actually captured (smallest currency unit), or null if nothing paid yet. */
  paidAmount: number | null;
  /** Currency of the paid amount, or null if nothing paid yet. */
  paidCurrency: string | null;
}

/**
 * Fetches a checkout session and returns both its metadata and what was
 * actually paid — never trust a webhook's event type alone to mean the
 * expected amount was captured (see #17 in the payment-cluster audit):
 * whichever `payments` entry has status "paid" is the authoritative record.
 */
export async function getCheckoutSessionDetails(checkoutSessionId: string): Promise<CheckoutSessionDetails> {
  const res = await fetch(`${API_BASE}/checkout_sessions/${checkoutSessionId}`, {
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayMongo checkout session lookup failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as PaymongoResource<CheckoutSessionAttributes>;
  const attrs = json.data.attributes;
  const paidPayment = attrs.payments?.find((payment) => payment.attributes.status === "paid") ?? null;

  return {
    metadata: attrs.metadata,
    paidAmount: paidPayment?.attributes.amount ?? null,
    paidCurrency: paidPayment?.attributes.currency ?? null,
  };
}

export interface PaymongoEvent {
  data: {
    id: string;
    type: string;
    attributes: {
      type: string; // e.g. "checkout_session.payment.paid"
      data: {
        id: string; // the checkout session id
        type: string;
        attributes: Record<string, unknown>;
      };
    };
  };
}

export class SignatureVerificationError extends Error {}

/**
 * Verifies a PayMongo webhook and returns the parsed event.
 *
 * Algorithm confirmed against the official PHP SDK's WebhookService
 * (github.com/paymongo/paymongo-php), since PayMongo's own docs site was
 * mid-restructure with several 404s when this was built — not guessed:
 *
 *   header = "t=<timestamp>,te=<test_sig>,li=<live_sig>"
 *   signed_payload = `${timestamp}.${rawBody}`
 *   expected = HMAC_SHA256(signed_payload, webhookSecret) as hex
 *   compare `expected` against whichever of te/li is non-empty
 */
export function verifyPaymongoWebhook(rawBody: string, signatureHeader: string, webhookSecret: string): PaymongoEvent {
  const parts = signatureHeader.split(",");
  if (parts.length < 3) {
    throw new SignatureVerificationError("Malformed Paymongo-Signature header.");
  }

  const fields = new Map(
    parts.map((part) => {
      const [key, value] = part.split("=");
      return [key, value ?? ""];
    })
  );

  const timestamp = fields.get("t");
  const testSignature = fields.get("te");
  const liveSignature = fields.get("li");
  const comparisonSignature = liveSignature || testSignature;

  if (!timestamp || !comparisonSignature) {
    throw new SignatureVerificationError("Paymongo-Signature header is missing required fields.");
  }

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(comparisonSignature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new SignatureVerificationError("Signature mismatch.");
  }

  // Replay protection: the HMAC covers `${timestamp}.${rawBody}`, but a
  // correctly-signed body from months ago would otherwise verify forever.
  // This check must run AFTER the signature comparison above, and must
  // throw the same error as a bad signature — a wrong signature and a
  // stale-but-correctly-signed timestamp should be indistinguishable to
  // the caller (no timing/response-shape signal about which reason it was).
  const timestampSeconds = Number.parseInt(timestamp, 10);
  const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new SignatureVerificationError("Signature mismatch.");
  }

  return JSON.parse(rawBody) as PaymongoEvent;
}
