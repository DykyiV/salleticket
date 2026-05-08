import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asol BUS — Bus ticket marketplace",
  description:
    "Asol BUS — find and book bus tickets online. Compare routes, carriers, and prices in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
