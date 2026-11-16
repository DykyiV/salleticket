import * as Sentry from "@sentry/nextjs";

// Errors only. The site handles passengers' personal data, so nothing from
// the request (body, cookies, query) or from local variables leaves the server.
// Without NEXT_PUBLIC_SENTRY_DSN nothing is sent at all.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
});
