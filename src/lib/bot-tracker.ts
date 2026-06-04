// Edge-compatible bot visit recorder. Used by middleware.ts.
// Direct neon() call instead of getSql() to avoid pulling the schema-init
// machinery from db.ts into Edge bundles (that path is Node-only).

import { neon } from "@neondatabase/serverless";

const MAX_UA_LEN = 500;
const MAX_PATH_LEN = 500;

export async function recordBotVisit(args: {
  botName: string;
  userAgent: string;
  path: string;
}): Promise<void> {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) return;
  const sql = neon(url);
  const ua = args.userAgent.slice(0, MAX_UA_LEN);
  const path = args.path.slice(0, MAX_PATH_LEN);
  // bot_visits table is created by ensureSchema() in db.ts; if it's not yet
  // present (first deploy before any /api/health hit) the insert throws and
  // the caller will swallow it.
  await sql`
    INSERT INTO bot_visits (bot_name, user_agent, path)
    VALUES (${args.botName}, ${ua}, ${path})
  `;
}
