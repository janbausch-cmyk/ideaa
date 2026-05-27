<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/peak-wordmark-1200-dark.png">
    <img alt="IDEAA" src="public/peak-wordmark-1200.png" width="360">
  </picture>
</p>

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

## Phase A monetization (IDEAA-69)

Stripe Payment Links surfaced at the bottom of every public Ausarbeitung.
Three tiers (€25 / €50 / €100), manual delivery, no auth. CTA clicks are
counted in the `cta_events` table; purchases ping Jan via Telegram
(`/api/stripe/webhook`). Setup checklist and delivery process:
[`docs/phase-a-monetization.md`](docs/phase-a-monetization.md).

## Deploy

Push to `main` and Vercel auto-deploys. Production needs `DATABASE_URL` (or
the Vercel Neon integration) configured before the form will work.

## Telegram bridge (internal — IDEAA-27)

Internal-only Telegram bot for Jan to interact with Paperclip from his
phone. **Webhook-only flow** — Telegram calls `/api/telegram/webhook` when
Jan sends the bot a message, the bot answers; there is **no proactive
push** from the bridge. To check what's new, Jan runs `/inbox`.

Lives inside this app under `/api/telegram/*`; same Vercel deploy, same
Postgres. Not part of the customer product surface.

### One-time setup

1. **BotFather:** create a bot (`/newbot`) and grab the token.
2. **Vercel env:** set the variables in `.env.example` under
   `--- Telegram bridge ---` and `--- Paperclip API ---`. At minimum:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (any random string),
   `TELEGRAM_ALLOWED_USER_IDS` (Jan's TG user id),
   `PAPERCLIP_API_URL`, `PAPERCLIP_BOT_API_KEY`, `PAPERCLIP_COMPANY_ID`,
   `ADMIN_TOKEN`.
3. **Register the webhook** with Telegram (replace the host):
   ```bash
   curl -X POST https://<vercel-host>/api/telegram/admin \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"op":"register-webhook"}'
   ```
   Verify with `GET /api/telegram/admin` (same auth).
4. **Register Jan's chat** so the bot can resolve the Telegram user to a
   Paperclip user when answering commands:
   ```bash
   curl -X POST https://<vercel-host>/api/telegram/admin \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"op":"register-chat","telegram_user_id":"<TG-user-id>","telegram_chat_id":"<TG-chat-id>","paperclip_user_id":"<JAN-paperclip-id>","display_name":"Jan"}'
   ```
   Easiest way to get `telegram_chat_id`: send any message to the bot, then
   look at the most recent webhook payload in Vercel logs.

### Routes

- `POST /api/telegram/webhook` — Telegram → Paperclip ingress. Validates
  the `X-Telegram-Bot-Api-Secret-Token` header against
  `TELEGRAM_WEBHOOK_SECRET`.
- `GET|POST /api/telegram/admin` — `register-webhook`, `delete-webhook`,
  `register-chat`. Requires `Authorization: Bearer $ADMIN_TOKEN`.

### Commands

- `/inbox` — list your open Paperclip assignments.
- `/status` — bridge health (mapping, inbox count, active context).
- `/new <title>` — create an issue. Goal defaults to
  `TELEGRAM_NEW_DEFAULT_GOAL_ID`, falling back to the goal of the chat's
  current active context (set by tagging an issue with `#IDEAA-N` in a
  reply, or by running `/new`). Default assignee is
  `TELEGRAM_NEW_DEFAULT_ASSIGNEE_AGENT_ID` (unset = unassigned).
- `/help` — quick reference.

### Replying to issues

Plain text reply → comment on the chat's active issue. Tag any message
with `#IDEAA-N` to switch context to that issue (and post the comment
there). The active context is also pinned by `/new` and persists across
messages.

Inline-button callbacks (Akzeptieren / Ablehnen / Später) are wired and
flip the issue status (`in_progress` / `cancelled` / `backlog`); they
appear on messages the bot itself produces (e.g. an enriched `/inbox`
output in a later slice).

### Voice

Telegram voice messages get downloaded, sent to OpenAI Whisper
(`whisper-1`), and the transcript is treated as if Jan had typed it
(routed via the same active-context-or-tag flow as text). The bot
echoes the transcript back as a `🎙️ Transkribiert: …` preview so Jan
can sanity-check what landed before any follow-up reply.

Requires `OPENAI_API_KEY` in Vercel-Env. Without it, voice messages
get a friendly "not configured" reply. Hard cap of 5 min per voice
message (Whisper is fine with longer, but the latency / cost gets
silly for chat use).

### Whitelist

Every incoming update is rejected unless `from.id` is in
`TELEGRAM_ALLOWED_USER_IDS`. Empty list = bot is closed to everyone.
