import type { Config } from "tailwindcss";

/**
 * Design tokens (Kaufmann Reisen):
 *   navy   #142C2A — primary dark (header text, hero, footer)
 *   brand  #0F766E — accent: buttons, links, focus (teal scale)
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
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        navy: {
          DEFAULT: "#142C2A",
          950: "#0a1a19",
          900: "#142C2A",
          800: "#1e3d3b",
          700: "#2a514e",
          600: "#3a6360",
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
