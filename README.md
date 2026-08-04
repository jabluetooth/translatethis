# TranslateThis

Turns technical writing into stakeholder-ready translations. Paste text or drag in a file, pick an audience level and tone, hit Translate. See [`TranslateThis_PRD_v1.1.md`](./TranslateThis_PRD_v1.1.md) for the product spec and the audit notes behind the decisions below.

## Status

The core flow is fully wired and runnable: text/file input → Groq (streamed) → translated output. Anonymous visitors get 3 free translations/day (Upstash-backed); signed-in users (Clerk) get 20/month and their translations are saved to Supabase/Postgres automatically, visible in a history panel on the page. **Live tiers today: Free (anonymous) and signed-in Free.** Pro (₱170 one-time, 30-day pass via PayMongo) is fully built and tested but hidden on `/pricing` — shows "Coming soon" — until `PAYMONGO_SECRET_KEY` is set; no PayMongo account exists yet. Monitoring is still a stub — see "What's stubbed" below.

## Quick start

```bash
npm install
cp .env.example .env.local
# set GROQ_API_KEY in .env.local — get one at https://console.groq.com/keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `GROQ_API_KEY` set, the UI loads but translation requests return a clear 503 rather than failing silently.

Health check: `GET /api/health` reports whether Groq is configured.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript | One deployable, SSR for SEO, Route Handlers cover the API — no separate backend service needed for a stateless translate call |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI primitives) | Accessible-by-default components, matches the WCAG 2.2 AA requirement in the PRD |
| File upload | react-dropzone | Drag-and-drop with a keyboard/click fallback |
| File parsing | `pdf-parse`, `mammoth` | In-memory only — nothing touches disk (see NFR in the PRD). Magic-byte sniffed against the claimed extension and parsed under a 10s timeout before an expensive parser ever touches it — see "Security" below |
| AI | Groq via the Vercel AI SDK (`ai`, `@ai-sdk/groq`), streamed | Groq's inference speed keeps translation latency low even on longer inputs; model id is env-configurable (`GROQ_MODEL`, defaults to `openai/gpt-oss-120b`) |
| Rate limiting | Upstash Redis, falls back to an in-process Map | Three tiers: 3/day anonymous (IP+cookie bound), 20/month signed-in (PRD §8 Free tier), 300/day Pro (generous, not unlimited — see "Security") |
| Auth | Clerk, via `clerkMiddleware()` in `src/proxy.ts` | Makes `auth()`/`getCurrentUserId()` available anywhere; protects no routes by default, so anonymous use is untouched |
| Database | Postgres via Supabase + Drizzle ORM, migrated | Signed-in translations are saved automatically (`src/lib/db/users.ts`); glossary/org tables exist for Team tier but aren't used yet |
| Payments | PayMongo, hosted Checkout Session, live | PH-based (Stripe doesn't support PH merchant payouts). Sells a one-time 30-day Pro pass, **not** a recurring subscription — PayMongo's hosted Checkout is one-time-payment only; true recurring billing needs their separate Subscriptions API, which has no hosted page and requires building custom card-vaulting UI. Not worth the complexity here — see `src/lib/paymongo.ts` |
| Monitoring | Sentry + PostHog (both no-op until DSN/key set) | `src/instrumentation.ts` / `src/instrumentation-client.ts` |

## Project layout

```
src/
  app/
    page.tsx                        the translate UI
    pricing/page.tsx                Free vs Pro, Upgrade button, success/canceled banners
    api/translate/route.ts          core endpoint: form-data in, streamed text out; gates on Pro, saves history
    api/history/route.ts            signed-in user's last 30 translations
    api/health/route.ts
    api/paymongo/checkout/route.ts  creates a Checkout Session, returns the redirect URL
    api/paymongo/webhook/route.ts   verifies signature + freshness, idempotent, verifies paid amount, grants Pro
    api/history/[id]/route.ts       DELETE a single saved translation
  components/
    auth/auth-status.tsx         sign in/up buttons + user menu (renders nothing if Clerk isn't configured)
    history/history-panel.tsx    recent-translations list + delete/clear-all (only mounted when auth is configured — see page.tsx)
    pricing/upgrade-button.tsx   client component: POSTs to the checkout route, redirects to PayMongo
    translate/                   input panel, dropzone, controls, output panel, quota-hint.tsx
  hooks/use-translate.ts     client-side fetch + stream reader
  lib/
    groq.ts        prompts.ts  readability.ts  file-parser.ts  rate-limit.ts  guest.ts
    auth.ts        paymongo.ts monitoring.ts
    db/schema.ts  db/client.ts  db/users.ts  db/history.ts   # users.ts: syncUser/saveTranslation/getRecentTranslations/grantProPass/isProUser; history.ts: deleteTranslation/deleteAllTranslations
  proxy.ts                    clerkMiddleware() when Clerk is configured, passthrough otherwise
  instrumentation.ts          Sentry server init (no-op without SENTRY_DSN)
  instrumentation-client.ts   Sentry + PostHog client init (no-op without keys)
```

Note on `useUser()`: any component that calls Clerk's client hooks is only ever *mounted* (not just internally early-returned) when a server-side `isAuthConfigured()` check has already confirmed `<ClerkProvider>` is present — see the `authEnabled` prop threaded from `page.tsx` into `TranslateWorkspace`/`QuotaHint`, and the conditional `{authEnabled && <HistoryPanel />}`. Calling a Clerk hook without a `ClerkProvider` ancestor is a real crash risk, not just a style preference.

## What's stubbed (and why)

No credentials were available while scaffolding most of this, so anything beyond the core translate flow + auth is wired for correctness but not exercised against a real service yet. Each stub fails loud and specific rather than silently:

- **Database (Supabase/Drizzle)**: `users`/`translations`/Pro status are all live. `organizations`/`glossary_terms` (Team tier) still have no reads/writes — there's no Team tier for sale (see PRD audit note on why it was deliberately left off `/pricing`).
- **Monitoring**: Sentry and PostHog both check for their env vars before initializing; everything else works identically with or without them.

## Security

A full audit (`quality-guardian`) ran against this codebase and found 21 real issues, all fixed and individually verified (typecheck/lint clean, plus targeted runtime tests against the live dev server and the real Supabase instance — not just "it compiles"). Worth knowing what changed and why, since some of it affects how you'd extend this code:

- **Anonymous rate limiting is IP+cookie bound, not cookie-only** (`src/lib/guest.ts`). The `tt_guest_id` cookie is validated against nanoid's own format before being trusted (an invalid/missing cookie just gets a fresh one, never used as a raw key), and the actual rate-limit identifier is `${ip}:${guestId}` — a bare `curl` loop without a cookie jar no longer gets a free unmetered identity every request.
- **Rate limiting (and the request-size check) happen before the request body is ever read** (`src/app/api/translate/route.ts`). A request over quota, or one whose `Content-Length` exceeds the file-size limit, is rejected before `request.formData()`, file parsing, or the Clerk Backend API call — so a quota-exhausted caller can't burn CPU/API-call budget on every rejected request.
- **Pro is a generous ceiling (300/day), not an unlimited bypass** — one ₱170 payment no longer buys genuinely unbounded concurrent inference forever. If the DB check that confirms someone is actually Pro fails (e.g. a Supabase hiccup), the request gets a 503 asking to retry, rather than silently treating a paying user as free-tier and spending one of their (nonexistent) free-tier tokens.
- **File uploads are sniffed by magic bytes, not trusted by extension**, and both parsers (`pdf-parse`, `mammoth`) run under a 10-second timeout — closes a decompression-bomb / extension-spoofing path where a 2MB file renamed to `.docx` could otherwise tie up a request indefinitely.
- **The PayMongo webhook is replay-resistant and idempotent, and actually recovers from transient failures.** The signature check rejects timestamps more than 5 minutes old (a captured-and-replayed valid signature no longer works forever), each event id is claimed via `INSERT ... ON CONFLICT DO NOTHING` before processing (duplicate/retried deliveries of an *already-succeeded* event are skipped), and — this is the part that's easy to get subtly wrong — if processing fails *after* the event is claimed, the claim is released and the handler returns 500 (not 200), so PayMongo's own retry mechanism can actually recover the grant instead of the idempotency check silently swallowing every future retry of a payment that never got fulfilled.
- **The webhook also verifies the paid amount/currency**, not just the event type, before granting anything — not exploitable today (the checkout session amount is server-fixed), but a landmine avoided for whenever a second price point exists.
- **Security headers are set app-wide** (`next.config.ts`): CSP (scoped to the third-party origins this app actually talks to — Clerk, PostHog, Sentry, Groq, Supabase), `X-Frame-Options: DENY` + `frame-ancestors 'none'` (clickjacking), HSTS, `X-Content-Type-Options: nosniff`, and a strict `Referrer-Policy`.
- **A defense-in-depth `Origin` check** on `/api/paymongo/checkout` (the one state-changing, unauthenticated-by-CORS-preflight endpoint that creates a real payment session) rejects cross-origin POSTs, backing up Clerk's `SameSite=Lax` session cookie rather than relying on it alone.
- **History deletion is real, not just documented as an intent.** `DELETE /api/history/[id]` and `DELETE /api/history` (clear all) exist and are scoped to the signed-in user's own rows — this is the actual right-to-erasure path referenced in `schema.ts`'s comment on the `translations` table (signing in is the consent boundary for auto-save; deleting is how you withdraw it, there's no separate opt-in checkbox).
- **Config-error messages no longer leak to unauthenticated callers.** A missing `GROQ_API_KEY` now returns a generic "temporarily unavailable" to the client (the real cause is logged server-side); `/api/health` no longer reports which services are configured.

### Testing the PayMongo webhook locally

PayMongo's servers can't reach `localhost`, so real webhook delivery only works once deployed with a public URL registered in their dashboard. To test the handler locally, sign a fake event yourself with the same algorithm PayMongo uses (see `src/lib/paymongo.ts`'s `verifyPaymongoWebhook` — implemented from the official PHP SDK's source, since PayMongo's docs site had several 404s mid-restructure when this was built) and POST it directly:

```js
import { createHmac } from "node:crypto";
const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
// data.id is the EVENT id (used for idempotency — reuse it and the second
// POST will be silently skipped, as intended). data.attributes.data.id is
// the checkout session id, a different thing — see webhook/route.ts.
const body = JSON.stringify({ data: { id: `evt_test_${Date.now()}`, attributes: { type: "checkout_session.payment.paid", data: { id: "cs_..." } } } });
const ts = Math.floor(Date.now() / 1000); // must be within 5 minutes of "now" — see verifyPaymongoWebhook
const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
// POST body to /api/paymongo/webhook with header: Paymongo-Signature: t=${ts},te=${sig},li=
```

## Known gap vs. the PRD

The naming collision flagged in the PRD's audit section (§0) — an existing App Store app is also called "TranslateThis" — is a product/legal decision, not something code can fix. Resolve before public launch.

## Commands

```bash
npm run dev          # start dev server (Turbopack)
npm run build        # production build
npm run lint         # ESLint
npm run db:generate  # generate a Drizzle migration from schema.ts
npm run db:migrate   # apply migrations (needs DIRECT_URL — see .env.example)
npm run db:studio    # Drizzle Studio
```
