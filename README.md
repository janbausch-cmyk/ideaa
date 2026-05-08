# IDEAA

Paste an idea, get a validation report.

IDEAA turns raw ideas into validated, actionable business opportunities using
AI-assisted analysis and implementation planning. The user pastes a raw idea
and gets back (a) a validation report and (b) an implementation plan they can
act on.

## Stack (v0)

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind v4)
- **Deploy target:** Vercel (free tier)
- **LLM provider:** Anthropic Claude API (prompt caching support)

See `IDEAA-2` ticket comment for the full stack rationale.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` — Postgres connection string used by the idea capture flow.
  In Vercel production, add the Neon integration (Storage → Create database →
  Neon Postgres) and the platform injects `POSTGRES_URL` automatically; the
  app reads `DATABASE_URL` first, then falls back to `POSTGRES_URL`.
- `ANTHROPIC_API_KEY` — Claude API key, required for the analysis pipeline
  (wired up in a later ticket).

The `ideas` table is created on first request — no manual migration step.

## Routes

- `/` — paste an idea, hit submit.
- `/ideas/<id>` — shareable URL showing the idea's processing status. The
  status flips from `processing` → `ready` once the analysis pipeline lands.

### Admin

- `/admin/login` — token form. Sets a 7-day HttpOnly cookie holding the value of `ADMIN_TOKEN`.
- `/admin/ideas` — list of every idea with status filter, full-text search (raw text, analysis report, admin note), and sort.
- `/admin/ideas/<id>` — detail view: original text, analysis output, tool trace, error message, plus actions to set the status, save a note + tags, kick off a re-analyse, or delete the row.
- `/api/admin/export?format=json|csv` — full DB export, gated by the same admin token (cookie or `Authorization: Bearer`).
- `/api/admin/analyze/<id>` — existing trace endpoint, now also gated.

The admin surface is locked closed unless `ADMIN_TOKEN` is set on the deployment.

## Deploy

Push to `main` and Vercel auto-deploys. Production needs `DATABASE_URL` (or
the Vercel Neon integration) configured before the form will work.

## Telegram bridge (internal — IDEAA-27)

Internal-only Telegram bot that lets Jan get pushed agent activity and reply
inline. Lives inside this app under `/api/telegram/*`; same Vercel deploy,
same Postgres. Not part of the customer product surface.

### One-time setup

1. **BotFather:** create a bot (`/newbot`) and grab the token.
2. **Vercel env:** set the variables in `.env.example` under
   `--- Telegram bridge ---` and `--- Paperclip API ---`. At minimum:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (any random string),
   `TELEGRAM_ALLOWED_USER_IDS` (Jan's TG user id), `JAN_PAPERCLIP_USER_ID`,
   `PAPERCLIP_API_URL`, `PAPERCLIP_BOT_API_KEY`, `PAPERCLIP_COMPANY_ID`,
   `CRON_SECRET`, `ADMIN_TOKEN`.
3. **Register the webhook** (replace the host):
   ```bash
   curl -X POST https://<vercel-host>/api/telegram/admin \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"op":"register-webhook"}'
   ```
   Verify with `GET /api/telegram/admin` (same auth).
4. **Register Jan's chat** so the push worker knows where to send:
   ```bash
   curl -X POST https://<vercel-host>/api/telegram/admin \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"op":"register-chat","telegram_user_id":"<TG-user-id>","telegram_chat_id":"<TG-chat-id>","paperclip_user_id":"<JAN-paperclip-id>","display_name":"Jan"}'
   ```
   Easiest way to get `telegram_chat_id`: send any message to the bot, then
   look at the most recent webhook payload in Vercel logs.
5. **Cron:** `vercel.json` registers `/api/telegram/push` to fire every
   minute. Vercel auto-includes `Authorization: Bearer $CRON_SECRET`.

### Routes

- `POST /api/telegram/webhook` — Telegram → Paperclip ingress. Validates the
  `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.
- `GET|POST /api/telegram/push` — cron-driven push of new assignments,
  mentions, and approvals to Jan.
- `GET|POST /api/telegram/admin` — `register-webhook`, `delete-webhook`,
  `register-chat`. Requires `Authorization: Bearer $ADMIN_TOKEN`.

### Behaviour

- **Push (slice 1):** any new Paperclip issue with
  `assigneeUserId == JAN_PAPERCLIP_USER_ID` updated since the last cursor
  hit gets a Telegram message with inline Akzeptieren / Ablehnen / Später
  buttons. The pushed issue becomes Jan's "active context".
- **Pull (slice 1):** plain text → comment on the active issue. Tag any
  message with `#IDEAA-12` to override the routing. Buttons map to
  `accept` (status → in_progress), `reject` (cancelled), `defer` (backlog).
- **Commands (slice 4):**
  - `/inbox` — list your open Paperclip assignments.
  - `/status` — bridge health (mapping, inbox count, push events 24h).
  - `/new <title>` — create an issue. Goal defaults to
    `TELEGRAM_NEW_DEFAULT_GOAL_ID`, falling back to the goal of the last
    push-context issue. Default assignee is
    `TELEGRAM_NEW_DEFAULT_ASSIGNEE_AGENT_ID` (unset = unassigned).
  - `/help` — quick reference.
- **Voice / approvals:** wired in upcoming slices.

### Whitelist

Every incoming update is rejected unless `from.id` is in
`TELEGRAM_ALLOWED_USER_IDS`. Empty list = bot is closed to everyone.
