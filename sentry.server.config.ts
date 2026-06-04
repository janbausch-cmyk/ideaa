import * as Sentry from "@sentry/nextjs";

// Only initialise when DSN is provided. Without DSN, Sentry calls anywhere
// in the app are silent no-ops, so the rest of the codebase can use
// `Sentry.captureException` etc. unconditionally.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Trace 10 % of server requests; bump if you need more granularity.
    tracesSampleRate: 0.1,
    // Don't pull stack frames for events that originate from the linked-server
    // SDK (those are visible in Anthropic dashboards already).
    ignoreErrors: ["AbortError"],
  });
}
