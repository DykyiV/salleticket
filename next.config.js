/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * The staff area lives in /cabinet. These keep links from the former
   * /admin section (bookmarks, e-mailed report links) working after the
   * merge of `main` into the operational-model architecture.
   */
  async redirects() {
    return [
      { source: "/admin/settlements", destination: "/cabinet/finance", permanent: true },
      { source: "/admin/commissions", destination: "/cabinet/finance/commissions", permanent: true },
      { source: "/admin/reports/carrier", destination: "/cabinet/finance/carrier-report", permanent: true },
      { source: "/admin/reports", destination: "/cabinet/reports", permanent: true },
      { source: "/admin/tickets", destination: "/cabinet/tickets", permanent: true },
      { source: "/admin/stats", destination: "/cabinet/stats", permanent: true },
      { source: "/admin/settings", destination: "/cabinet/settings", permanent: true },
    ];
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- this config is CommonJS
const { withSentryConfig } = require("@sentry/nextjs/config");

// Sentry's build integration. Readable stack traces need source maps, and
// those are uploaded only when the build has SENTRY_AUTH_TOKEN.
module.exports = withSentryConfig(nextConfig, {
  org: "ltd-grandes-tour",
  project: "kaufmann-reisen-web",
  silent: !process.env.CI,
  // The build tool's own usage statistics are not sent to Sentry.
  telemetry: false,
});
