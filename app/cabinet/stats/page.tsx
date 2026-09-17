import PageHeader from "@/components/cabinet/PageHeader";
import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/routes/dates";

export const dynamic = "force-dynamic";

export default async function CabinetStatsPage() {
  const [
    users,
    templates,
    departures,
    upcoming,
    tickets,
    bookings,
    revenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.routeTemplate.count(),
    prisma.departure.count(),
    prisma.departure.count({ where: { date: { gte: todayUtc() } } }),
    prisma.ticket.count(),
    prisma.booking.count(),
    prisma.booking.aggregate({ _sum: { finalPrice: true } }),
  ]);

  const cards = [
    { label: "Користувачі", value: users },
    { label: "Шаблони маршрутів", value: templates },
    { label: "Усі виїзди", value: departures },
    { label: "Майбутні виїзди", value: upcoming },
    { label: "Квитки", value: tickets },
    { label: "Бронювання", value: bookings },
    {
      label: "Обіг, €",
      value: (revenue._sum.finalPrice ?? 0).toFixed(2),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Статистика"
        subtitle="Короткі цифри по кабінету. Графіки сезонності додамо пізніше."
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
          </article>
        ))}
      </div>
    </div>
  );
}
