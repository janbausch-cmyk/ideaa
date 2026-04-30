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

## Deploy

Push to `main` and Vercel auto-deploys. Production needs `DATABASE_URL` (or
the Vercel Neon integration) configured before the form will work.
