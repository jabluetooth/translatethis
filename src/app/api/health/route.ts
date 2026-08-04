export const runtime = "nodejs";

export async function GET() {
  // Deliberately doesn't expose config details like groqConfigured — that's
  // useful reconnaissance for an attacker probing a misconfigured deploy,
  // and this endpoint is unauthenticated by design (uptime monitoring).
  // `status: "ok"` already tells you the process is up and responding.
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
