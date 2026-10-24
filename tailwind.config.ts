import type { Config } from "tailwindcss";

/**
 * Design tokens (brief «Asol BUS»):
 *   navy   #0B1F3A — primary dark (header text, hero, footer)
 *   brand  #2563EB — accent: buttons, links, focus (Tailwind blue scale)
 *   ok     #16A34A — confirmations, free seats
 *   warn   #F59E0B — warnings, unpaid
 *   bg     #F8FAFC, text #1F2937 (ink)
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        navy: {
          DEFAULT: "#0B1F3A",
          950: "#06132a",
          900: "#0B1F3A",
          800: "#132c4f",
          700: "#1c3a63",
          600: "#2a4c7a",
        },
        ok: { DEFAULT: "#16A34A", 50: "#f0fdf4", 100: "#dcfce7", 600: "#16A34A", 700: "#15803d" },
        warn: { DEFAULT: "#F59E0B", 50: "#fffbeb", 100: "#fef3c7", 500: "#F59E0B", 700: "#b45309" },
        ink: { DEFAULT: "#1F2937", muted: "#4b5563", soft: "#6b7280" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,31,58,0.04), 0 8px 24px -8px rgba(11,31,58,0.12)",
        lift: "0 2px 4px rgba(11,31,58,0.06), 0 20px 40px -12px rgba(11,31,58,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
