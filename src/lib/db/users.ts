import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { PRO_PASS_DAYS } from "@/lib/constants";
import { translations, users } from "@/lib/db/schema";

/**
 * Lazily creates/updates the `users` row for a Clerk-authenticated visitor.
 * No Clerk webhook is set up (would need a public HTTPS endpoint), so this
 * runs inline on each authenticated translate request instead — cheap
 * upsert, fine at this scale.
 */
export async function syncUser(userId: string, email: string): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoUpdate({ target: users.id, set: { email } });
}

/**
 * Grants (or extends) a Pro pass. Stacks on top of any remaining time
 * rather than resetting it, so buying early never wastes what's left.
 *
 * Done as a single atomic `UPDATE ... RETURNING` (GREATEST/COALESCE
 * computed in SQL) rather than a SELECT-then-UPDATE — two concurrent
 * webhook deliveries for the same user (e.g. two distinct legitimate
 * purchases in quick succession) could otherwise both read the same
 * starting `proExpiresAt` and one grant would silently get clobbered by
 * the other's write.
 */
export async function grantProPass(userId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .update(users)
    .set({
      plan: "pro",
      proExpiresAt: sql`GREATEST(COALESCE(${users.proExpiresAt}, now()), now()) + interval '${sql.raw(String(PRO_PASS_DAYS))} days'`,
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!row) {
    // Shouldn't normally happen — the webhook handler calls syncUser()
    // first — but fail loudly rather than silently granting nothing.
    throw new Error(`grantProPass: no users row found for id "${userId}".`);
  }
}

export async function isProUser(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select({ proExpiresAt: users.proExpiresAt }).from(users).where(eq(users.id, userId));
  return Boolean(row?.proExpiresAt && row.proExpiresAt > new Date());
}

const MAX_SOURCE_EXCERPT_CHARS = 500;

export async function saveTranslation(input: {
  userId: string;
  sourceText: string;
  level: string;
  tone: string;
  format: string;
  outputText: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(translations).values({
    userId: input.userId,
    sourceExcerpt: input.sourceText.slice(0, MAX_SOURCE_EXCERPT_CHARS),
    level: input.level,
    tone: input.tone,
    format: input.format,
    outputText: input.outputText,
  });
}

const HISTORY_PAGE_SIZE = 30;

export async function getRecentTranslations(userId: string) {
  const db = getDb();
  return db.query.translations.findMany({
    where: eq(translations.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: HISTORY_PAGE_SIZE,
  });
}
