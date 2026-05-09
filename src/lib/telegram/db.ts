import { getSql } from "@/lib/db";

let telegramSchemaReady: Promise<void> | null = null;

export async function ensureTelegramSchema(): Promise<void> {
  if (telegramSchemaReady) return telegramSchemaReady;
  const sql = getSql();
  telegramSchemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_chats (
        telegram_user_id   bigint PRIMARY KEY,
        telegram_chat_id   bigint NOT NULL,
        paperclip_user_id  text   NOT NULL,
        display_name       text,
        created_at         timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_chat_context (
        telegram_user_id   bigint PRIMARY KEY REFERENCES telegram_chats(telegram_user_id) ON DELETE CASCADE,
        active_issue_id    text,
        set_at             timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_push_cursor (
        telegram_user_id   bigint PRIMARY KEY REFERENCES telegram_chats(telegram_user_id) ON DELETE CASCADE,
        assignments_at     timestamptz NOT NULL DEFAULT now(),
        mentions_at        timestamptz NOT NULL DEFAULT now(),
        approvals_at       timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS telegram_pushed_events (
        id                  bigserial PRIMARY KEY,
        telegram_user_id    bigint NOT NULL,
        kind                text NOT NULL,
        source_id           text NOT NULL,
        telegram_msg_id     bigint NOT NULL,
        paperclip_issue_id  text,
        payload             jsonb,
        created_at          timestamptz NOT NULL DEFAULT now(),
        UNIQUE (telegram_user_id, kind, source_id)
      )
    `;
  })().catch((err) => {
    telegramSchemaReady = null;
    throw err;
  });
  return telegramSchemaReady;
}

export type TelegramChatRow = {
  telegram_user_id: string; // bigint comes back as string from neon
  telegram_chat_id: string;
  paperclip_user_id: string;
  display_name: string | null;
};

export async function upsertTelegramChat(input: {
  telegramUserId: number | bigint;
  telegramChatId: number | bigint;
  paperclipUserId: string;
  displayName?: string | null;
}): Promise<void> {
  await ensureTelegramSchema();
  const sql = getSql();
  await sql`
    INSERT INTO telegram_chats (telegram_user_id, telegram_chat_id, paperclip_user_id, display_name)
    VALUES (${input.telegramUserId.toString()}::bigint,
            ${input.telegramChatId.toString()}::bigint,
            ${input.paperclipUserId},
            ${input.displayName ?? null})
    ON CONFLICT (telegram_user_id) DO UPDATE
      SET telegram_chat_id = EXCLUDED.telegram_chat_id,
          paperclip_user_id = EXCLUDED.paperclip_user_id,
          display_name = COALESCE(EXCLUDED.display_name, telegram_chats.display_name)
  `;
}

export async function getTelegramChat(
  telegramUserId: number | bigint,
): Promise<TelegramChatRow | null> {
  await ensureTelegramSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT telegram_user_id::text AS telegram_user_id,
           telegram_chat_id::text AS telegram_chat_id,
           paperclip_user_id,
           display_name
    FROM telegram_chats
    WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
    LIMIT 1
  `) as TelegramChatRow[];
  return rows[0] ?? null;
}

export async function listTelegramChats(): Promise<TelegramChatRow[]> {
  await ensureTelegramSchema();
  const sql = getSql();
  return (await sql`
    SELECT telegram_user_id::text AS telegram_user_id,
           telegram_chat_id::text AS telegram_chat_id,
           paperclip_user_id,
           display_name
    FROM telegram_chats
  `) as TelegramChatRow[];
}

export async function setActiveIssueContext(
  telegramUserId: number | bigint,
  issueId: string,
): Promise<void> {
  await ensureTelegramSchema();
  const sql = getSql();
  await sql`
    INSERT INTO telegram_chat_context (telegram_user_id, active_issue_id, set_at)
    VALUES (${telegramUserId.toString()}::bigint, ${issueId}, now())
    ON CONFLICT (telegram_user_id) DO UPDATE
      SET active_issue_id = EXCLUDED.active_issue_id,
          set_at = now()
  `;
}

export async function getActiveIssueContext(
  telegramUserId: number | bigint,
): Promise<{ active_issue_id: string | null; set_at: string } | null> {
  await ensureTelegramSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT active_issue_id, set_at
    FROM telegram_chat_context
    WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
    LIMIT 1
  `) as Array<{ active_issue_id: string | null; set_at: string }>;
  return rows[0] ?? null;
}

export type PushCursor = {
  assignments_at: string;
  mentions_at: string;
  approvals_at: string;
};

export async function getOrInitPushCursor(
  telegramUserId: number | bigint,
): Promise<PushCursor> {
  await ensureTelegramSchema();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO telegram_push_cursor (telegram_user_id)
    VALUES (${telegramUserId.toString()}::bigint)
    ON CONFLICT (telegram_user_id) DO UPDATE
      SET telegram_user_id = telegram_push_cursor.telegram_user_id
    RETURNING assignments_at, mentions_at, approvals_at
  `) as PushCursor[];
  return rows[0];
}

export async function advancePushCursor(
  telegramUserId: number | bigint,
  field: "assignments_at" | "mentions_at" | "approvals_at",
  newAt: string,
): Promise<void> {
  await ensureTelegramSchema();
  const sql = getSql();
  // Only move forward — never rewind.
  if (field === "assignments_at") {
    await sql`
      UPDATE telegram_push_cursor
      SET assignments_at = GREATEST(assignments_at, ${newAt}::timestamptz)
      WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
    `;
  } else if (field === "mentions_at") {
    await sql`
      UPDATE telegram_push_cursor
      SET mentions_at = GREATEST(mentions_at, ${newAt}::timestamptz)
      WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
    `;
  } else {
    await sql`
      UPDATE telegram_push_cursor
      SET approvals_at = GREATEST(approvals_at, ${newAt}::timestamptz)
      WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
    `;
  }
}

export type PushedEventInsert = {
  telegramUserId: number | bigint;
  kind: "assignment" | "mention" | "approval" | "issue_detail";
  sourceId: string;
  telegramMsgId: number | bigint;
  paperclipIssueId?: string | null;
  payload?: unknown;
};

export async function recordPushedEvent(
  e: PushedEventInsert,
): Promise<{ inserted: boolean }> {
  await ensureTelegramSchema();
  const sql = getSql();
  const payloadJson = e.payload === undefined ? null : JSON.stringify(e.payload);
  // ON CONFLICT UPDATE rather than DO NOTHING so the latest message id wins:
  // if the user repeats /issue IDEAA-N, the callback lookup must find the
  // most-recently-sent message, not the original.
  const rows = (await sql`
    INSERT INTO telegram_pushed_events
      (telegram_user_id, kind, source_id, telegram_msg_id, paperclip_issue_id, payload)
    VALUES (${e.telegramUserId.toString()}::bigint,
            ${e.kind},
            ${e.sourceId},
            ${e.telegramMsgId.toString()}::bigint,
            ${e.paperclipIssueId ?? null},
            ${payloadJson}::jsonb)
    ON CONFLICT (telegram_user_id, kind, source_id) DO UPDATE
      SET telegram_msg_id = EXCLUDED.telegram_msg_id,
          payload = EXCLUDED.payload,
          created_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `) as Array<{ id: string; inserted: boolean }>;
  return { inserted: rows[0]?.inserted ?? false };
}

export async function findPushedEventByMessageId(
  telegramUserId: number | bigint,
  telegramMsgId: number | bigint,
): Promise<{
  kind: string;
  source_id: string;
  paperclip_issue_id: string | null;
  payload: unknown;
} | null> {
  await ensureTelegramSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT kind, source_id, paperclip_issue_id, payload
    FROM telegram_pushed_events
    WHERE telegram_user_id = ${telegramUserId.toString()}::bigint
      AND telegram_msg_id = ${telegramMsgId.toString()}::bigint
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{
    kind: string;
    source_id: string;
    paperclip_issue_id: string | null;
    payload: unknown;
  }>;
  return rows[0] ?? null;
}
