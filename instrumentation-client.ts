import * as Sentry from "@sentry/nextjs";

// Client-side Sentry. Uses NEXT_PUBLIC_SENTRY_DSN so the DSN is shipped to
// the browser; the DSN is not a secret. Without DSN, Sentry is silent.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    // No session replay by default — privacy + size. Turn on later if useful.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Optional: Track navigation timings.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
