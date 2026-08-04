import { getCurrentUserId } from "@/lib/auth";
import { deleteTranslation } from "@/lib/db/history";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: RouteContext<"/api/history/[id]">) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Sign in to manage translation history." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteTranslation(userId, id);
    if (!deleted) {
      // Scoped to userId in the query itself, so this also covers "exists
      // but belongs to someone else" — same 404 either way, no information
      // leak about whether the id exists at all.
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("[history] failed to delete item:", error);
    captureException(error, { route: "/api/history/[id]" });
    return Response.json({ error: "Could not delete that item right now." }, { status: 500 });
  }
}
