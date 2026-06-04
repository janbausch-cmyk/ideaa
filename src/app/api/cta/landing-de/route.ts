import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IDEAA-99: lightweight click tracking for the DE landing page CTA.
// Writes one row to cta_events with tier='landing_de'. Best-effort only —
// never blocks navigation, so the client should sendBeacon and proceed.

// Simple in-memory rate limit per IP. Per-instance only (Vercel will scale
// to multiple lambda instances, each with its own bucket), but enough to
// stop a single attacker from spamming a million rows from one machine.
const LIMIT = 30; // requests
const WINDOW_MS = 60 * 1000; // per 60s
const MAX_TRACKED_IPS = 10_000;
const bucket = new Map<string, number[]>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for is "client, proxy1, proxy2" — the leftmost is the
    // originating client per Vercel's docs.
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let timestamps = bucket.get(ip);
  if (!timestamps) {
    if (bucket.size >= MAX_TRACKED_IPS) {
      // Crude eviction: drop the oldest tracked entry. The map keeps
      // insertion order, so .keys().next() returns the oldest.
      const oldest = bucket.keys().next().value;
      if (oldest !== undefined) bucket.delete(oldest);
    }
    timestamps = [];
    bucket.set(ip, timestamps);
  }
  // Drop expired entries.
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  if (timestamps.length >= LIMIT) return true;
  timestamps.push(now);
  return false;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return Response.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

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
