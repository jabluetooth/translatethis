import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// TODO: set NEXT_PUBLIC_SENTRY_DSN to enable client-side error tracking.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

// TODO: set NEXT_PUBLIC_POSTHOG_KEY to enable product analytics
// (session count, level/tone adoption — see PRD §7.2 engagement metrics).
if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
  });
}
