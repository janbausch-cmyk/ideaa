// Next.js instrumentation entry. Loads Sentry init for the right runtime.
// When SENTRY_DSN is unset, Sentry.init() inside the config files is skipped
// and the whole integration is a no-op.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
