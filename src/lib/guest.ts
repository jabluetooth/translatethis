import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { GUEST_COOKIE_NAME } from "@/lib/constants";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// nanoid()'s default alphabet/length (21 chars, URL-safe). A cookie value
// that doesn't match this shape didn't come from us — never trusted as an
// identifier, just replaced with a freshly generated one.
const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

const UNKNOWN_IP = "unknown";

/**
 * Identifies an anonymous visitor for rate-limiting purposes only (never
 * used for auth or attached to any account). Backed by a cookie so repeat
 * visits share one quota; falls back silently if cookies are blocked.
 *
 * The cookie is validated against nanoid's own format before being trusted
 * — an attacker who sends an arbitrary/missing cookie value gets a fresh,
 * server-generated id instead of controlling the rate-limit key directly.
 */
export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existing && GUEST_ID_PATTERN.test(existing)) return existing;

  const id = nanoid();
  cookieStore.set(GUEST_COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  return id;
}

/**
 * Best-effort caller IP from the leftmost `x-forwarded-for` entry (the
 * client-facing end of the proxy chain). Not spoof-proof on its own — a
 * client can send its own `x-forwarded-for` — but every deploy target here
 * (Vercel et al.) overwrites/appends to it at the edge before the request
 * reaches app code, so the leftmost entry is the actual client. Falls back
 * to a constant rather than throwing if the header is absent (e.g. local
 * dev without a proxy in front).
 */
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : UNKNOWN_IP;
}

/**
 * Rate-limit identifier for an anonymous visitor: IP-bound so a client that
 * never sends/keeps the guest cookie is still metered (a bare curl loop
 * that omits cookies would otherwise get a fresh, unmetered identity every
 * request), and cookie-bound so distinct visitors sharing one IP (offices,
 * NAT, CGNAT) aren't collapsed into a single shared quota. Both the cookie
 * and the IP have to be rotated together to evade the limit.
 */
export async function getGuestRateLimitId(request: Request): Promise<string> {
  const guestId = await getOrCreateGuestId();
  return `${getClientIp(request)}:${guestId}`;
}
