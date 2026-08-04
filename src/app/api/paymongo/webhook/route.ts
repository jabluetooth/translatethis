import { eq } from "drizzle-orm";
import { PRO_PASS_PRICE_CENTAVOS } from "@/lib/constants";
import { getDb } from "@/lib/db/client";
import { webhookEvents } from "@/lib/db/schema";
import { grantProPass, syncUser } from "@/lib/db/users";
import { captureException } from "@/lib/monitoring";
import { getCheckoutSessionDetails, isPaymongoConfigured, isTimeoutError, SignatureVerificationError, verifyPaymongoWebhook } from "@/lib/paymongo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPaymongoConfigured() || !process.env.PAYMONGO_WEBHOOK_SECRET) {
    return Response.json({ error: "PayMongo webhook isn't configured." }, { status: 501 });
  }

  const signature = request.headers.get("paymongo-signature");
  if (!signature) {
    return Response.json({ error: "Missing Paymongo-Signature header." }, { status: 400 });
  }

  // Signature verification needs the exact raw bytes — must read as text
  // before any JSON parsing, or the HMAC will never match (this is the most
  // common webhook integration bug, for PayMongo same as anyone else's).
  const rawBody = await request.text();

  let event;
  try {
    event = verifyPaymongoWebhook(rawBody, signature, process.env.PAYMONGO_WEBHOOK_SECRET);
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      captureException(error, { route: "/api/paymongo/webhook" });
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }
    throw error;
  }

  const eventType = event.data.attributes.type;
  console.log(`[paymongo webhook] received ${eventType}`);

  if (eventType === "checkout_session.payment.paid") {
    // The event's own id — NOT event.data.attributes.data.id, which is the
    // checkout session id (a different resource, and not unique per
    // delivery). Deduping on the wrong id would silently no-op idempotency.
    const eventId = event.data.id;
    const checkoutSessionId = event.data.attributes.data.id;
    const db = getDb();

    // Claim this event id before doing anything else — PayMongo retries on
    // timeout/5xx, and grantProPass extends remaining time, so N deliveries
    // of the SAME event would otherwise stack N x PRO_PASS_DAYS.
    const claimed = await db
      .insert(webhookEvents)
      .values({ id: eventId })
      .onConflictDoNothing({ target: webhookEvents.id })
      .returning({ id: webhookEvents.id });

    if (claimed.length === 0) {
      console.log(`[paymongo webhook] event ${eventId} already processed, skipping.`);
      return Response.json({ received: true });
    }

    try {
      const details = await getCheckoutSessionDetails(checkoutSessionId);
      const userId = details.metadata?.userId;
      if (!userId) {
        // Permanent — this checkout session will never have a userId no
        // matter how many times it's retried. Leave the claim in place
        // (reprocessing changes nothing) and move on.
        captureException(new Error(`Checkout session ${checkoutSessionId} has no userId in metadata.`), {
          route: "/api/paymongo/webhook",
          checkoutSessionId,
        });
        return Response.json({ received: true });
      }

      // Never trust the event type alone — confirm what was actually
      // captured matches what Pro costs before granting anything. Not
      // exploitable today (createProCheckoutSession always uses a fixed
      // ₱170 line item), but a landmine once a second price point exists.
      if (details.paidAmount === null || details.paidAmount < PRO_PASS_PRICE_CENTAVOS || details.paidCurrency !== "PHP") {
        captureException(new Error("PayMongo checkout session paid amount/currency did not match expectations."), {
          route: "/api/paymongo/webhook",
          checkoutSessionId,
          userId,
          paidAmount: details.paidAmount,
          paidCurrency: details.paidCurrency,
          expectedAmount: PRO_PASS_PRICE_CENTAVOS,
        });
        // Permanent data mismatch, not transient — retrying just repeats
        // the same mismatch forever. Leave the claim in place.
        return Response.json({ received: true });
      }

      // The users row should already exist (created at their first
      // translate call), but a webhook can in principle arrive for an
      // account that's never actually called /api/translate — email isn't
      // available here, so fall back to a placeholder rather than fail.
      await syncUser(userId, details.metadata?.email ?? "unknown@paymongo-webhook");
      await grantProPass(userId);
      console.log(`[paymongo webhook] granted Pro to user ${userId}`);
    } catch (error) {
      // A TRANSIENT failure (network/DB/PayMongo API hiccup) happened after
      // the event was claimed above — release the claim so a legitimate
      // PayMongo retry can actually reprocess it, instead of the idempotency
      // check silently swallowing the retry forever. Returning 500 (not
      // 200) is what makes PayMongo retry in the first place; without both
      // of these together, one transient hiccup could permanently and
      // silently cost a paying customer their grant, recoverable only by
      // noticing the Sentry alert and fixing it by hand.
      await db
        .delete(webhookEvents)
        .where(eq(webhookEvents.id, eventId))
        .catch((cleanupError) => {
          console.error(`[paymongo webhook] failed to release idempotency claim for event ${eventId}:`, cleanupError);
        });

      if (isTimeoutError(error)) {
        console.error(`[paymongo webhook] timed out calling PayMongo for checkout session ${checkoutSessionId}:`, error);
      } else {
        console.error("[paymongo webhook] failed to grant Pro:", error);
      }
      captureException(error, { route: "/api/paymongo/webhook", checkoutSessionId });
      return Response.json({ error: "Internal error processing webhook." }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
