import * as Sentry from "@sentry/nextjs";

// Edge runtime (middleware.ts, edge route handlers). Limited API surface.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
