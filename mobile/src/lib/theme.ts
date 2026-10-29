/** Grandes Tour colours: brand teal from the app icon, neutrals from the site. */
export const colors = {
  brand: "#207D79",
  brandDark: "#17605D",
  brandSoft: "#E6F2F1",
  navy: "#0B1F3A",
  ink: "#1F2937",
  muted: "#4B5563",
  soft: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  line: "#E2E8F0",
  ok: "#15803D",
  okSoft: "#DCFCE7",
  warn: "#B45309",
  warnSoft: "#FEF3C7",
  info: "#1D4ED8",
  infoSoft: "#DBEAFE",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
} as const;

export const radius = { card: 16, button: 12, pill: 999 } as const;

export const shadow = {
  shadowColor: "#0B1F3A",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
