export const MAX_TEXT_CHARS = 5000;
export const MAX_FILE_TEXT_CHARS = 20000;
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_FILE_EXTENSIONS = [".txt", ".md", ".log", ".pdf", ".docx"] as const;

export const ANONYMOUS_FREE_TRANSLATIONS = 3;
export const ANONYMOUS_WINDOW = "1 d";
export const GUEST_COOKIE_NAME = "tt_guest_id";

// PRD §8 Free tier (signed-in, no card required): 20 translations/month.
export const ACCOUNT_FREE_TRANSLATIONS = 20;
export const ACCOUNT_WINDOW = "30 d";

// Pro is a one-time payment, not truly unlimited compute (see audit #9) —
// this ceiling is generous relative to the free tiers above but keeps a
// single payment from becoming unbounded Groq spend.
export const PRO_DAILY_TRANSLATIONS = 300;
export const PRO_WINDOW = "1 d";

// Pro: one-time 30-day pass via PayMongo (no recurring billing — see
// lib/paymongo.ts for why). Amount is in centavos (PayMongo's smallest
// PHP unit), matching how it's sent to their API.
export const PRO_PASS_PRICE_CENTAVOS = 17000; // ₱170
export const PRO_PASS_DAYS = 30;

// openai/gpt-oss-120b is Groq's current flagship production model.
// llama-3.3-70b-versatile / llama-3.1-8b-instant were deprecated June 2026 —
// see https://console.groq.com/docs/deprecations. For a faster/cheaper
// option, openai/gpt-oss-20b is the recommended replacement for 8b-instant.
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
