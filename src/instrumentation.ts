import * as Sentry from "@sentry/nextjs";

// TODO: set SENTRY_DSN (server) to enable. No-ops entirely without it —
// nothing here blocks local dev or a deploy that hasn't wired Sentry up yet.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
