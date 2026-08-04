import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  ACCOUNT_FREE_TRANSLATIONS,
  ACCOUNT_WINDOW,
  ANONYMOUS_FREE_TRANSLATIONS,
  ANONYMOUS_WINDOW,
  PRO_DAILY_TRANSLATIONS,
  PRO_WINDOW,
} from "@/lib/constants";
import type { RateLimitStatus } from "@/lib/types";

export type RateLimitTier = "anonymous" | "account" | "pro";

const TIER_CONFIG = {
  anonymous: { limit: ANONYMOUS_FREE_TRANSLATIONS, window: ANONYMOUS_WINDOW, prefix: "translatethis:anon" },
  account: { limit: ACCOUNT_FREE_TRANSLATIONS, window: ACCOUNT_WINDOW, prefix: "translatethis:account" },
  // Pro is a one-time payment, not truly unlimited usage — this is a high
  // but finite daily ceiling so one payment can't become unbounded
  // concurrent inference cost forever (see audit #9).
  pro: { limit: PRO_DAILY_TRANSLATIONS, window: PRO_WINDOW, prefix: "translatethis:pro" },
} as const;

function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redisClient: Redis | null = null;
const upstashLimiters = new Map<RateLimitTier, Ratelimit>();

function getUpstashLimiter(tier: RateLimitTier): Ratelimit {
  let limiter = upstashLimiters.get(tier);
  if (!limiter) {
    if (!redisClient) {
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
    const { limit, window, prefix } = TIER_CONFIG[tier];
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix,
    });
    upstashLimiters.set(tier, limiter);
  }
  return limiter;
}

/**
 * Parses the tier window strings used in constants.ts (e.g. "1 d", "30 d")
 * into milliseconds. Only handles the "<number> d" format actually used
 * here — not a general duration parser, since `Ratelimit.slidingWindow`'s
 * own string format supports more units we don't currently use.
 */
function parseWindowMs(window: string): number {
  const match = /^(\d+)\s*d$/.exec(window.trim());
  if (!match) {
    throw new Error(`Unsupported rate-limit window format: "${window}". Expected "<number> d".`);
  }
  const days = Number(match[1]);
  return days * 24 * 60 * 60 * 1000;
}

/**
 * In-process fallback used when Upstash isn't configured (local dev, or a
 * deploy that hasn't wired it up yet). Per-instance only — does NOT hold a
 * limit across multiple server instances/regions. Fine for a single dev
 * server; replace with Upstash before shipping to production traffic.
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Hard cap so a long-running process without Upstash configured can't grow
// this Map forever (see audit #8). With the guest identifier now IP+cookie
// bound and validated (see lib/guest.ts), unbounded churn from arbitrary
// cookies is no longer possible, but this is cheap insurance regardless.
const MEMORY_STORE_MAX_ENTRIES = 50_000;

let warnedAboutMemoryFallbackInProd = false;

function warnIfMemoryFallbackInProduction(): void {
  if (warnedAboutMemoryFallbackInProd) return;
  if (process.env.NODE_ENV !== "production") return;
  warnedAboutMemoryFallbackInProd = true;
  console.error(
    "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set in production — " +
      "falling back to an in-process rate limiter. This is NOT shared across instances/regions " +
      "and resets on every restart/deploy. Configure Upstash to get a real, distributed limit."
  );
}

/**
 * Opportunistically sweeps expired entries (and, failing that, the oldest
 * ones) so the Map never grows without bound between restarts.
 */
function evictIfStoreTooLarge(): void {
  if (memoryStore.size < MEMORY_STORE_MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }

  if (memoryStore.size < MEMORY_STORE_MAX_ENTRIES) return;

  // Nothing expired yet but we're still over the cap — fall back to
  // dropping the oldest entries (Map preserves insertion order) rather than
  // let it grow further.
  const overBy = memoryStore.size - MEMORY_STORE_MAX_ENTRIES + 1;
  const oldestKeys = Array.from(memoryStore.keys()).slice(0, overBy);
  for (const key of oldestKeys) memoryStore.delete(key);
}

function checkMemoryRateLimit(tier: RateLimitTier, identifier: string): RateLimitStatus {
  warnIfMemoryFallbackInProduction();

  const { limit, window } = TIER_CONFIG[tier];
  const windowMs = parseWindowMs(window);
  const key = `${tier}:${identifier}`;
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    evictIfStoreTooLarge();
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, resetMs: windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, limit, remaining: 0, resetMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { success: true, limit, remaining: limit - entry.count, resetMs: entry.resetAt - now };
}

export async function checkRateLimit(identifier: string, tier: RateLimitTier = "anonymous"): Promise<RateLimitStatus> {
  if (isUpstashConfigured()) {
    const { success, limit, remaining, reset } = await getUpstashLimiter(tier).limit(identifier);
    return { success, limit, remaining, resetMs: Math.max(0, reset - Date.now()) };
  }
  return checkMemoryRateLimit(tier, identifier);
}
