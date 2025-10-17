// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Client must use NEXT_PUBLIC_* so it can run in the browser
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tweak later if needed
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),
  replaysSessionSampleRate: Number(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0.1),
  replaysOnErrorSampleRate: Number(process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1),

  environment: process.env.SENTRY_ENVIRONMENT,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],
});
