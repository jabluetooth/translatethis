import { getCurrentUserId } from "@/lib/auth";
import { deleteAllTranslations } from "@/lib/db/history";
import { getRecentTranslations } from "@/lib/db/users";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Sign in to view translation history." }, { status: 401 });
  }

  try {
    const items = await getRecentTranslations(userId);
    return Response.json({ items });
  } catch (error) {
    console.error("[history] failed to load:", error);
    captureException(error, { route: "/api/history" });
    return Response.json({ error: "Could not load history right now." }, { status: 500 });
  }
}

/** Clears all of the signed-in user's saved translations. */
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Sign in to manage translation history." }, { status: 401 });
  }

  try {
    const count = await deleteAllTranslations(userId);
    return Response.json({ deleted: count });
  } catch (error) {
    console.error("[history] failed to clear:", error);
    captureException(error, { route: "/api/history", method: "DELETE" });
    return Response.json({ error: "Could not clear history right now." }, { status: 500 });
  }
}
