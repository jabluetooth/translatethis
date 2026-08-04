import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { isAuthConfigured } from "@/lib/auth";

/**
 * Renders nothing until Clerk is configured — the anonymous quota (see
 * lib/rate-limit.ts) is meant to work with zero account friction, so there's
 * no "sign in" nag until there's somewhere for it to actually lead.
 */
export function AuthStatus() {
  if (!isAuthConfigured()) return null;

  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
