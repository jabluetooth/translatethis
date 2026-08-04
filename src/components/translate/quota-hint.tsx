"use client";

import { useUser } from "@clerk/nextjs";

interface QuotaHintProps {
  remaining: number;
}

/**
 * Only ever mounted when the parent has confirmed (server-side) that Clerk
 * is configured — see TranslateWorkspace's `authEnabled` prop — so
 * useUser() always has a ClerkProvider ancestor to read from.
 */
export function QuotaHint({ remaining }: QuotaHintProps) {
  const { isSignedIn } = useUser();

  return (
    <span className="text-xs text-muted-foreground">
      {remaining} free {remaining === 1 ? "translation" : "translations"} left{" "}
      {isSignedIn ? "this month" : "before sign-in"}
    </span>
  );
}
