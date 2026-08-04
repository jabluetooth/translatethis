import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";

/**
 * User-initiated deletion — the actual GDPR-erasure path for saved
 * translations (see schema.ts comment on `translations`: signing in is the
 * consent boundary for auto-save, this is the corresponding right to
 * withdraw it). Scoped to `userId` in the WHERE clause, not just the id, so
 * there's no way to delete another user's row by guessing a uuid.
 */
export async function deleteTranslation(userId: string, translationId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(translations)
    .where(and(eq(translations.id, translationId), eq(translations.userId, userId)))
    .returning({ id: translations.id });
  return deleted.length > 0;
}

export async function deleteAllTranslations(userId: string): Promise<number> {
  const db = getDb();
  const deleted = await db.delete(translations).where(eq(translations.userId, userId)).returning({ id: translations.id });
  return deleted.length;
}
