'use client';

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // secure env-based DSN (no hardcoding)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Controlled sampling (adjust via Vercel env vars)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),
  replaysSessionSampleRate: Number(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0.1),
  replaysOnErrorSampleRate: Number(process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1),

  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  enableLogs: true,
  debug: false,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],

  // Optional: scrub any sensitive info before sending
  beforeSend(event) {
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization;
    }
    return event;
  },
});

// Optional router hook if you want page transition tracking
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
