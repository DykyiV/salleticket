import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Asol BUS",
  description: "Bus ticket marketplace admin and agent system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
