"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/** Last-resort error page: reports a crash of the root layout to Sentry. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uk">
      <body>
        {/* The App Router gives no status code, so 0 renders the generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
