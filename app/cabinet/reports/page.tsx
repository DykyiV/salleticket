import PageHeader from "@/components/cabinet/PageHeader";
import { prisma } from "@/lib/db";
import { formatUkDate, todayUtc } from "@/lib/routes/dates";
import { TICKET_STATUS_LABEL } from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

export default async function CabinetReportsPage() {
  const bookings = await prisma.booking.findMany({
    include: {
      ticket: { include: { trip: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const upcoming = await prisma.departure.findMany({
    where: { date: { gte: todayUtc() } },
    include: { template: true },
    orderBy: { date: "asc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Звіти"
        subtitle="Останні квитки та найближчі виїзди. Експорт Excel/PDF додамо окремо."
      />

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <header className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
          Останні бронювання
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Код</th>
                <th className="px-4 py-2">Пасажир</th>
                <th className="px-4 py-2">Маршрут</th>
                <th className="px-4 py-2">Сума</th>
                <th className="px-4 py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Бронювань ще немає.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">{b.reference}</td>
                    <td className="px-4 py-2">
                      {b.firstName} {b.lastName}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {b.ticket.trip
                        ? `${b.ticket.trip.fromCity} → ${b.ticket.trip.toCity}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">€{b.finalPrice.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {TICKET_STATUS_LABEL[b.ticket.status] ?? b.ticket.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <header className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
          Найближчі виїзди
        </header>
        <ul className="divide-y divide-slate-100 text-sm">
          {upcoming.length === 0 ? (
            <li className="px-4 py-6 text-slate-500">Немає запланованих виїздів.</li>
          ) : (
            upcoming.map((d) => (
              <li key={d.id} className="flex justify-between px-4 py-3">
                <span>{d.template.name}</span>
                <span className="text-slate-600">{formatUkDate(d.date)}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
