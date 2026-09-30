import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { reconcileTicketPayment } from "@/lib/payments";
import { markPassengerBoarded } from "@/lib/tickets/board";
import { formatTripMoment } from "@/lib/tickets/boardingPass";
import { buildETicket } from "@/lib/tickets/eTicket";
import {
  eur,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

/** Boarding check page — the QR code on the ticket points here. */
export default async function CheckTicketPage(
  props: {
    params: Promise<{ reference: string }>;
  }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "DRIVER")) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          legs: { include: { assignment: { include: { bus: true, leg: true } } } },
          trip: { include: { carrier: true, departure: { include: { stops: true, bus: true } } } },
        },
      },
    },
  });
  if (!booking) notFound();

  await reconcileTicketPayment(booking.ticket.id);
  const fresh = await prisma.ticket.findUnique({ where: { id: booking.ticket.id } });
  const status = fresh?.status ?? booking.ticket.status;
  const valid =
    status === "PAID_ONLINE" || status === "PAID_CASH" || status === "RESERVED" || status === "AWAITING_PAYMENT";
  const boardedAt = valid ? await markPassengerBoarded(booking.ticket.id, user.id) : booking.ticket.boardedAt;
  const eTicket = buildETicket(booking);

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
          {valid ? "Пасажир сів в автобус" : "Квиток недійсний"}
        </p>
        {boardedAt ? (
          <p className="mt-1 text-sm text-slate-600">Посадку зафіксовано: {formatTripMoment(boardedAt)}</p>
        ) : null}
        <p className="mt-4 text-3xl font-bold tabular-nums">{eur(booking.finalPrice)}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500">Вартість квитка</p>
        <dl className="mt-4 space-y-1 text-left text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Пасажир</dt>
            <dd className="text-right font-medium">{eTicket.passenger}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Маршрут</dt>
            <dd className="text-right">
              {eTicket.routeFrom} → {eTicket.routeTo}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Виїзд</dt>
            <dd className="text-right">{eTicket.depart}</dd>
          </div>
          {eTicket.segments.map((segment) => (
            <div key={segment.order} className="flex justify-between gap-3">
              <dt className="text-slate-500">
                {segment.fromCity} → {segment.toCity}
              </dt>
              <dd className="text-right">
                {segment.bus} · {segment.seat}
              </dd>
            </div>
          ))}
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
