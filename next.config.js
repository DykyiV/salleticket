/**
 * Security headers on every answer. CSP only in production: the dev server
 * needs eval. Scripts and styles may be inline (Next.js inlines its own);
 * images may come from Grandes Tour's photo storage (bus photos).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://gtmain.blob.core.windows.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The ticket scanner (/cabinet/scan) uses the camera; nothing else is needed.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * The staff area lives in /cabinet. These keep links from the former
   * /admin section (bookmarks, e-mailed report links) working after the
   * merge of `main` into the operational-model architecture.
   */
  async redirects() {
    return [
      // One address for the site: www goes to the main domain.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kaufmann-reisen.de" }],
        destination: "https://kaufmann-reisen.de/:path*",
        permanent: true,
      },
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

module.exports = nextConfig;
