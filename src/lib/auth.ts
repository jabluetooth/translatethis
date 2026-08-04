export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

/**
 * Returns the signed-in Clerk user id, or null for anonymous visitors.
 * clerkMiddleware() runs via src/proxy.ts whenever Clerk is configured, so
 * auth() is safe to call anywhere in that case; the isAuthConfigured()
 * guard here just also covers the case where it isn't.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

export interface CurrentAccount {
  userId: string;
  email: string;
}

/**
 * Like getCurrentUserId(), but also fetches the email needed to sync the
 * `users` table (lib/db/users.ts). Costs an extra Backend API call
 * (currentUser() isn't just a local JWT read like auth() is) — only call
 * this where the email is actually needed.
 */
export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  if (!isAuthConfigured()) return null;

  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!user || !email) return null;

  return { userId: user.id, email };
}
