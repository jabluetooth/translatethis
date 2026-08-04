import { getCurrentAccount } from "@/lib/auth";
import { captureException } from "@/lib/monitoring";
import { createProCheckoutSession, isPaymongoConfigured, isTimeoutError } from "@/lib/paymongo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPaymongoConfigured()) {
    return Response.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  const account = await getCurrentAccount();
  if (!account) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  // Defense-in-depth against cross-origin form/fetch POSTs (JSON/multipart
  // POSTs are CORS-simple requests — no preflight) triggering a real
  // checkout session; Clerk's SameSite=Lax session cookie is the primary
  // defense, this backs it up. Only reject when Origin is PRESENT and
  // mismatched — some legitimate same-origin requests omit it depending on
  // browser/referrer-policy, so absence isn't treated as suspicious.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  try {
    const checkoutUrl = await createProCheckoutSession({
      userId: account.userId,
      email: account.email,
      successUrl: `${origin}/pricing?success=true`,
      cancelUrl: `${origin}/pricing?canceled=true`,
    });
    return Response.json({ url: checkoutUrl });
  } catch (error) {
    if (isTimeoutError(error)) {
      console.error("[paymongo/checkout] timed out calling PayMongo:", error);
    } else {
      console.error("[paymongo/checkout] failed:", error);
    }
    captureException(error, { route: "/api/paymongo/checkout" });
    return Response.json({ error: "Could not start checkout. Try again in a moment." }, { status: 502 });
  }
}
