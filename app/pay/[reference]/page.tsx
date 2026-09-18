import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import PaymentPanel from "@/components/payments/PaymentPanel";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { reconcileTicketPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: { reference: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          trip: true,
        },
      },
    },
  });
  if (!booking) notFound();
  if (booking.ticket.userId !== user.id && !hasRoleAtLeast(user.role, "AGENT")) {
    notFound();
  }

  await reconcileTicketPayment(booking.ticket.id);
  const fresh = await prisma.ticket.findUnique({
    where: { id: booking.ticket.id },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = fresh?.payments[0] ?? null;
  const settings = await getSiteSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Онлайн-оплата</h1>
        <p className="mt-1 text-sm text-slate-500">
          {booking.ticket.trip
            ? `${booking.ticket.trip.fromCity} → ${booking.ticket.trip.toCity}`
            : booking.reference}
        </p>
        <div className="mt-6">
          <PaymentPanel
            reference={booking.reference}
            settleMinutes={settings.paymentSettleMinutes}
            initial={{
              ticketStatus: fresh?.status ?? booking.ticket.status,
              finalPrice: fresh?.finalPrice ?? booking.finalPrice,
              payment: payment
                ? {
                    status: payment.status,
                    amount: payment.amount,
                    fullAmount: payment.fullAmount,
                    sentAt: payment.sentAt?.toISOString() ?? null,
                    settleAfter: payment.settleAfter?.toISOString() ?? null,
                    deadlineAt: payment.deadlineAt.toISOString(),
                  }
                : null,
            }}
          />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link href="/cabinet/tickets" className="underline">
            До списку квитків
          </Link>
        </p>
      </main>
    </div>
  );
}
