import { isProductionRuntime } from "@/lib/security/secrets";

/**
 * Which online-payment backend is live.
 *
 *   mock     — the built-in TEST payment page: pressing «pay» marks the
 *              payment as sent and it settles by itself. Fine for
 *              development, catastrophic on a live site (free tickets).
 *   disabled — no online payment: the booking form and ticket card hide it
 *              and the payment APIs refuse.
 *
 * Production defaults to disabled until a real provider (monobank) is
 * integrated. PAYMENT_PROVIDER=mock is honoured in production only together
 * with ALLOW_MOCK_PAYMENTS=1 — for a closed test/staging server, never a
 * live one.
 */
export type OnlinePaymentMode = "mock" | "disabled";

export function onlinePaymentMode(env: NodeJS.ProcessEnv = process.env): OnlinePaymentMode {
  const provider = (env.PAYMENT_PROVIDER ?? "").trim().toLowerCase();
  const production = env === process.env ? isProductionRuntime() : env.NODE_ENV === "production";
  if (provider === "" || provider === "mock") {
    if (!production) return "mock";
    return provider === "mock" && env.ALLOW_MOCK_PAYMENTS === "1" ? "mock" : "disabled";
  }
  // A named provider that is not implemented yet: stay closed.
  return "disabled";
}

export const onlinePaymentsEnabled = (): boolean => onlinePaymentMode() !== "disabled";

export const ONLINE_DISABLED_MESSAGE = "Онлайн-оплата тимчасово недоступна. Оберіть оплату в автобусі або в касі.";
