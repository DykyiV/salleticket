import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import { prisma } from "@/lib/db";
import { reconcileDuePayments } from "@/lib/payments";
import { buildLayout, parseCoachLayout } from "@/lib/seats";
import { occupiedSeatNumbers } from "@/lib/tickets/inventory";
import { eur, TICKET_STATUS_CLASS, TICKET_STATUS_LABEL } from "@/lib/tickets/labels";
import { addUtcDays, todayUtc, utcDateOnly } from "@/lib/routes/dates";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(raw: string | undefined, fallback: Date): Date {
  if (raw && ISO.test(raw)) {
    try {
      return utcDateOnly(raw);
    } catch {
      // fall through
    }
  }
  return fallback;
}

export default async function CabinetStatsPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  await reconcileDuePayments();
  const today = todayUtc();
  const tomorrow = addUtcDays(today, 1);

  const from = parseDay(searchParams?.from, today);
  const to = addUtcDays(parseDay(searchParams?.to, from), 1);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = addUtcDays(to, -1).toISOString().slice(0, 10);

  const [salesToday, bookingsToday, refundedToday, recent, totals] =
    await Promise.all([
      prisma.ticket.aggregate({
        _sum: { finalPrice: true },
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: { in: ["PAID_ONLINE", "PAID_CASH"] },
        },
      }),
      prisma.booking.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.ticket.aggregate({
        _sum: { finalPrice: true },
        where: { status: "REFUNDED", updatedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          ticket: {
            include: { trip: { select: { fromCity: true, toCity: true } } },
          },
        },
      }),
      prisma.ticket.count(),
    ]);

  // Free seats across departures in the selected period.
  const departures = await prisma.departure.findMany({
    where: { date: { gte: from, lt: to } },
    include: {
      template: { select: { name: true } },
      bus: { select: { layout: true } },
      trips: { select: { id: true, fromCity: true } },
    },
    orderBy: { date: "asc" },
  });

  type Row = {
    id: string;
    label: string;
    date: string;
    free: number;
    capacity: number;
  };
  const rows: Row[] = [];
  for (const departure of departures) {
    const capacity = departure.bus
      ? buildLayout(parseCoachLayout(departure.bus.layout)).seatCount
      : 46;
    for (const direction of ["out", "back"] as const) {
      const destination = departure.template.name.split("—")[1]?.trim();
      const trips = departure.trips.filter((t) =>
        direction === "out"
          ? destination
            ? t.fromCity !== destination
            : true
          : destination
            ? t.fromCity === destination
            : false
      );
      if (!trips.length) continue;
      const taken = await occupiedSeatNumbers(prisma, trips[0].id);
      const free = Math.max(0, capacity - taken.size);
      rows.push({
        id: `${departure.id}-${direction}`,
        label: `${departure.template.name} ${direction === "out" ? "туди" : "назад"}`,
        date: departure.date.toISOString().slice(0, 10),
        free,
        capacity,
      });
    }
  }
  const freeTotal = rows.reduce((sum, r) => sum + r.free, 0);
  const capacityTotal = rows.reduce((sum, r) => sum + r.capacity, 0);

  const presets = [
    { label: "Сьогодні", from: today, days: 1 },
    { label: "Завтра", from: addUtcDays(today, 1), days: 1 },
    { label: "7 днів", from: today, days: 7 },
    { label: "30 днів", from: today, days: 30 },
  ];

  const cards = [
    {
      label: "Продажі сьогодні",
      value: eur(salesToday._sum.finalPrice ?? 0),
      hint: "оплачені квитки",
    },
    { label: "Бронювання", value: String(bookingsToday), hint: "за сьогодні" },
    {
      label: "Вільні місця",
      value: String(freeTotal),
      hint:
        rows.length > 0
          ? `з ${capacityTotal} · ${fromIso}${fromIso !== toIso ? ` — ${toIso}` : ""}`
          : `немає виїздів у періоді`,
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
        subtitle="Продажі, вільні місця й повернення."
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

      <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Вільні місця на виїздах
          </h2>
          <form method="GET" action="/cabinet/stats" className="ml-auto flex flex-wrap items-end gap-2">
            <label className="block text-xs">
              <span className="mb-0.5 block text-slate-500">Від</span>
              <input
                type="date"
                name="from"
                defaultValue={fromIso}
                className="h-8 rounded border border-slate-300 px-2 text-xs"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-0.5 block text-slate-500">До</span>
              <input
                type="date"
                name="to"
                defaultValue={toIso}
                className="h-8 rounded border border-slate-300 px-2 text-xs"
              />
            </label>
            <button
              type="submit"
              className="h-8 rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:border-brand-300"
            >
              Показати
            </button>
          </form>
          <div className="flex gap-1.5">
            {presets.map((p) => {
              const f = p.from.toISOString().slice(0, 10);
              const t = addUtcDays(p.from, p.days - 1).toISOString().slice(0, 10);
              const active = f === fromIso && t === toIso;
              return (
                <Link
                  key={p.label}
                  href={`/cabinet/stats?from=${f}&to=${t}`}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                    active
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            У вибраному періоді виїздів немає.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1.5">Дата</th>
                <th>Напрямок</th>
                <th className="text-right">Вільно</th>
                <th className="text-right">Місць</th>
                <th className="w-40"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-1.5 tabular-nums text-slate-600">{row.date}</td>
                  <td className="text-slate-900">{row.label}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {row.free}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">
                    {row.capacity}
                  </td>
                  <td>
                    <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={`block h-full ${row.free / row.capacity < 0.15 ? "bg-rose-500" : "bg-emerald-500"}`}
                        style={{ width: `${(row.free / row.capacity) * 100}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
