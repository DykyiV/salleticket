import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";
import { formatUkDate } from "@/lib/routes/dates";
import {
  AGE_LABEL,
  eur,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

/** Boarding check page — the QR code on the ticket points here. */
export default async function CheckTicketPage({
  params,
}: {
  params: { reference: string };
}) {
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "DRIVER")) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: { include: { trip: { include: { carrier: true } } } },
    },
  });
  if (!booking) notFound();

  await reconcileTicketPayment(booking.ticket.id);
  const fresh = await prisma.ticket.findUnique({ where: { id: booking.ticket.id } });
  const status = fresh?.status ?? booking.ticket.status;
  const trip = booking.ticket.trip;
  const valid =
    status === "PAID_ONLINE" || status === "PAID_CASH" || status === "RESERVED";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-slate-50 p-6">
      <div
        className={`w-full rounded-3xl border-2 bg-white p-6 text-center ${
          valid ? "border-emerald-400" : "border-rose-400"
        }`}
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Перевірка квитка
        </p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-widest">
          {booking.reference}
        </p>
        <p
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${TICKET_STATUS_CLASS[status]}`}
        >
          {TICKET_STATUS_LABEL[status]}
        </p>
        <p className={`mt-4 text-lg font-bold ${valid ? "text-emerald-700" : "text-rose-700"}`}>
          {valid ? "Посадку дозволено" : "Квиток недійсний"}
        </p>
        <dl className="mt-4 space-y-1 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Пасажир</dt>
            <dd className="font-medium">
              {booking.firstName} {booking.lastName}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Категорія</dt>
            <dd>{AGE_LABEL[booking.ageCategory] ?? booking.ageCategory}</dd>
          </div>
          {trip ? (
            <div className="flex justify-between">
              <dt className="text-slate-500">Рейс</dt>
              <dd>
                {trip.fromCity} → {trip.toCity}
              </dd>
            </div>
          ) : null}
          {trip ? (
            <div className="flex justify-between">
              <dt className="text-slate-500">Дата</dt>
              <dd>{formatUkDate(trip.departureTime)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-slate-500">Місце</dt>
            <dd className="font-semibold">
              {booking.ticket.seatNumber != null
                ? `№${booking.ticket.seatNumber}`
                : "без місця"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Ціна</dt>
            <dd className="tabular-nums">{eur(booking.finalPrice)}</dd>
          </div>
        </dl>
        <Link
          href={`/cabinet/tickets/${booking.reference}`}
          className="mt-5 inline-block rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Відкрити в кабінеті
        </Link>
      </div>
    </main>
  );
}
