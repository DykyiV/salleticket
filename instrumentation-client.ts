import * as Sentry from "@sentry/nextjs";

// Browser errors only: no tracing, no session replay, no user details.
// Without NEXT_PUBLIC_SENTRY_DSN (read at build time) nothing is sent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: { userInfo: false, urlQueryParams: false },
});

// The SDK asks for this hook at build time; with tracing off it records nothing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
