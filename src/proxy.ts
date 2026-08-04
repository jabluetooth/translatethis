import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isAuthConfigured } from "@/lib/auth";

/**
 * Runs clerkMiddleware() whenever Clerk keys are present, which makes
 * auth()/getCurrentUserId() usable anywhere without protecting any route by
 * default — the anonymous translate flow (lib/rate-limit.ts) is untouched.
 * Falls through to a plain passthrough when Clerk isn't configured.
 *
 * Confirmed compatible with Next.js 16's `proxy` convention: `NextProxy` is
 * a direct type alias of `NextMiddleware` (see
 * node_modules/next/dist/server/web/types.d.ts), and clerkMiddleware()
 * returns exactly that (request, event) => ... shape.
 */
const handleAuth = isAuthConfigured() ? clerkMiddleware() : null;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (handleAuth) return handleAuth(request, event);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
