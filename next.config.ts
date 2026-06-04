import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

// Wrap with Sentry only when actually configured. Without DSN this would
// still bundle the Sentry webpack plugin but produce no useful output, so
// we skip the wrap entirely in that case to keep build output clean.
const finalConfig: NextConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Source map upload only happens when SENTRY_AUTH_TOKEN is set; in
      // local dev or preview deploys without the token, the build still
      // succeeds without uploads.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;

export default finalConfig;
