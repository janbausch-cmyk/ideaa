import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IDEAA-99: lightweight click tracking for the DE landing page CTA.
// Writes one row to cta_events with tier='landing_de'. Best-effort only —
// never blocks navigation, so the client should sendBeacon and proceed.
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const sql = getSql();
    const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const referer = request.headers.get("referer")?.slice(0, 500) ?? null;
    await sql`
      INSERT INTO cta_events (idea_id, tier, user_agent, referer)
      VALUES (NULL, 'landing_de', ${ua}, ${referer})
    `;
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
