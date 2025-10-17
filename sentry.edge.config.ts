// sentry.edge.config.ts
// This file configures the initialization of Sentry for edge features (middleware, edge routes, etc.)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Use environment variable for security (no hardcoding)
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Reasonable default sample rates (tune later)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),

  enableLogs: true,
  debug: false,
  environment: process.env.SENTRY_ENVIRONMENT ?? "development",
});
