// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Prefer private server DSN; fall back to public if needed
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sensible defaults (tune later in env)
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),

  // Optional: crank up while debugging, turn down in prod
  enableLogs: true,
  debug: false,

  environment: process.env.SENTRY_ENVIRONMENT ?? "development",
});
