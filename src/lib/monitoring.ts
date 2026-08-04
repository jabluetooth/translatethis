import * as Sentry from "@sentry/nextjs";

/**
 * Safe to call whether or not Sentry.init() ran (see instrumentation.ts /
 * instrumentation-client.ts, both gated on SENTRY_DSN being set). Without a
 * DSN this is a documented no-op in the SDK, not a crash.
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
