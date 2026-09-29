import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import {
  listRecentPayments,
  parsePaymentInput,
  PaymentInputError,
  recordPayment,
} from "@/lib/finance/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/finance/payments — recent payments to/from counterparties. */
export async function GET() {
  const guard = await requirePermission("finance.read");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ payments: await listRecentPayments(200) });
}

/**
 * POST /api/finance/payments
 * { kind: "CARRIER"|"AGENT", counterpartyId, direction: "OUTGOING"|"INCOMING",
 *   amount, paidAt: "YYYY-MM-DD", note?, settlementId? }
 */
export async function POST(req: NextRequest) {
  const guard = await requirePermission("finance.edit");
  if (!guard.ok) return guard.response;
  try {
    const input = parsePaymentInput(await req.json());
    const payment = await recordPayment(input, guard.session.email);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    if (err instanceof PaymentInputError || err instanceof SyntaxError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
