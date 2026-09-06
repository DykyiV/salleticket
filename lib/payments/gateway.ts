/**
 * Online payment gateway — the counterpart to lib/carriers/types.ts's
 * CarrierAdapter for actual money movement. No real gateway is wired in
 * yet (no charge() is called anywhere — bookings paid "online" today are a
 * demo flow, per the footer note on /booking), but refunds are modeled
 * against this interface now so plugging one in later (Stripe, LiqPay,
 * Fondy, ...) means implementing PaymentGateway and swapping
 * `getPaymentGateway()`'s return value — nothing in lib/tickets/cancel.ts
 * or its callers needs to change.
 *
 * Refund amount authority: lib/tickets/cancel.ts computes the *intended*
 * refund from RefundPolicy.onlineRefundPercent, then asks the gateway to
 * execute it. A real gateway's response is authoritative for what actually
 * moved (it may apply its own processor fees/rules) — the ticket is
 * updated with `refundedAmount` from the gateway result, not the
 * pre-computed intent.
 */

export type RefundRequest = {
  ticketId: string;
  /** Amount we intend to refund, in the trip's currency (EUR). */
  amount: number;
  currency: string;
};

export type RefundResult = {
  success: boolean;
  /** Gateway's own reference for this refund, for reconciliation. */
  providerRefundId?: string;
  /** Amount the gateway actually refunded — authoritative over the request. */
  refundedAmount: number;
  error?: string;
};

export interface PaymentGateway {
  readonly id: string;
  refund(request: RefundRequest): Promise<RefundResult>;
}

/**
 * Stand-in gateway: "refunds" always succeed for exactly the requested
 * amount, with no real money movement. Replace `getPaymentGateway()`'s
 * return value with a real adapter (e.g. StripeGateway) once a provider is
 * chosen and its API keys configured.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly id = "mock";

  async refund(request: RefundRequest): Promise<RefundResult> {
    return {
      success: true,
      providerRefundId: `MOCK-REFUND-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      refundedAmount: request.amount,
    };
  }
}

export function getPaymentGateway(): PaymentGateway {
  return new MockPaymentGateway();
}
