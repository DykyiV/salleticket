import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import { prisma } from "@/lib/db";
import { reconcileDuePayments } from "@/lib/payments";
import { eur, TICKET_STATUS_CLASS, TICKET_STATUS_LABEL } from "@/lib/tickets/labels";
import { todayUtc } from "@/lib/routes/dates";

export const dynamic = "force-dynamic";

export default async function CabinetStatsPage() {
  await reconcileDuePayments();
  const today = todayUtc();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const [
    salesToday,
    bookingsToday,
    refundedToday,
    todaysDepartures,
    recent,
    totals,
  ] = await Promise.all([
    prisma.ticket.aggregate({
      _sum: { finalPrice: true },
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: { in: ["PAID_ONLINE", "PAID_CASH"] },
      },
    }),
    prisma.booking.count({
      where: { createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.ticket.aggregate({
      _sum: { finalPrice: true },
      where: {
        status: "REFUNDED",
        updatedAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.departure.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { trips: { select: { id: true } } },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        ticket: { include: { trip: { select: { fromCity: true, toCity: true } } } },
      },
    }),
    prisma.ticket.count(),
  ]);

  const tripIds = todaysDepartures.flatMap((d) => d.trips.map((t) => t.id));
  const soldToday = tripIds.length
    ? await prisma.ticket.count({
        where: {
          status: { in: ["RESERVED", "AWAITING_PAYMENT", "PAID_ONLINE", "PAID_CASH"] },
          OR: [{ tripId: { in: tripIds } }, { returnTripId: { in: tripIds } }],
        },
      })
    : 0;
  const seatsTotal = todaysDepartures.length * 46;
  const seatsPct = seatsTotal ? Math.round((soldToday / seatsTotal) * 100) : 0;

  const cards = [
    {
      label: "Продажі сьогодні",
      value: eur(salesToday._sum.finalPrice ?? 0),
      hint: "оплачені квитки",
    },
    { label: "Бронювання", value: String(bookingsToday), hint: "за сьогодні" },
    {
      label: "Місця",
      value: `${seatsPct}%`,
      hint: `${soldToday} з ${seatsTotal} на сьогоднішніх виїздах`,
    },
    {
      label: "Повернення",
      value: eur(refundedToday._sum.finalPrice ?? 0),
      hint: "за сьогодні",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Продажі, заповненість і повернення за сьогодні."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <article
            key={c.label}
            className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {c.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{c.hint}</p>
          </article>
        ))}
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">
          Останні бронювання
        </h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {recent.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Link
                href={`/cabinet/tickets/${b.reference}`}
                className="font-mono text-xs font-semibold text-brand-700 hover:underline"
              >
                {b.reference}
              </Link>
              <span className="text-slate-900">
                {b.lastName} {b.firstName}
              </span>
              <span className="text-slate-500">
                {b.ticket.trip
                  ? `${b.ticket.fromCity ?? b.ticket.trip.fromCity} → ${b.ticket.toCity ?? b.ticket.trip.toCity}`
                  : "—"}
              </span>
              <span
                className={`ml-auto inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TICKET_STATUS_CLASS[b.ticket.status]}`}
              >
                {TICKET_STATUS_LABEL[b.ticket.status]}
              </span>
              <span className="tabular-nums text-slate-900">{eur(b.finalPrice)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-xs text-slate-400">
        Усього квитків у системі: {totals}.
      </p>
    </div>
  );
}
