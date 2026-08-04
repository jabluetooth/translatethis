import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Defense-in-depth, not the primary XSS defense (React already escapes all
// rendered content — nothing in src/ uses dangerouslySetInnerHTML/innerHTML/
// eval, confirmed in a security audit). Uses the "without nonces" approach
// from Next's own CSP guide rather than nonce-based, since nonces force
// every page to dynamic rendering — not worth it for a defense-in-depth
// header on an app with no inline first-party scripts to begin with.
//
// Scoped to the third-party origins this app can actually talk to once
// configured (see .env.example): Clerk, PostHog, Sentry, Groq, Supabase.
// Re-check this if a production Clerk instance ends up on a custom domain
// (dev/staging instances are always *.clerk.accounts.dev) or if a CSP
// violation shows up in the browser console after wiring up a new service.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://img.clerk.com;
  font-src 'self' data:;
  connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.groq.com https://*.supabase.co https://*.posthog.com https://*.sentry.io;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          // Belt-and-suspenders with frame-ancestors above for browsers
          // that predate CSP2 frame-ancestors support.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
