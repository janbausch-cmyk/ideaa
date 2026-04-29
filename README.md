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

Create a `.env.local` (see `.env.example` once added). Expected keys:

- `ANTHROPIC_API_KEY` — Claude API key, required for the analysis pipeline (added in a later ticket).

## Deploy

Push to `main` and Vercel auto-deploys. Initial Vercel project setup is
tracked separately — see follow-up issue.
