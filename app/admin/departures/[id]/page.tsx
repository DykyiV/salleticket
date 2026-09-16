import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-sky-50 text-sky-700 ring-sky-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default async function DepartureDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      carrier: true,
      tickets: {
        include: {
          booking: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!trip) notFound();

  const active = trip.tickets.filter(
    (t) => t.status !== "CANCELLED" && t.status !== "REFUNDED"
  );
  const revenue = active.reduce((s, t) => s + t.finalPrice, 0);
  const commission = active.reduce((s, t) => s + (t.commissionAmount ?? 0), 0);
  const byStatus = trip.tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/admin/departures"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            ← All departures
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {trip.fromCity} → {trip.toCity}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {trip.departureTime.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
            {trip.transportType} · {trip.carrier.name}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Tickets sold" value={String(active.length)} />
            <Stat label="Revenue" value={eur(revenue)} />
            <Stat label="Our commission" value={eur(commission)} />
            <Stat
              label="By status"
              value={Object.entries(byStatus)
                .map(([s, n]) => `${s}: ${n}`)
                .join(" · ")}
              small
            />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Reference</Th>
                  <Th>Passenger</Th>
                  <Th>Type</Th>
                  <Th>Booked by</Th>
                  <Th className="text-right">Price</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trip.tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      No tickets on this departure yet.
                    </td>
                  </tr>
                ) : (
                  trip.tickets.map((t) => (
                    <tr key={t.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.booking?.reference ?? t.id.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.booking
                          ? `${t.booking.firstName} ${t.booking.lastName}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.booking?.ageCategory ?? "—"}
                        {t.booking?.promoCode ? ` · ${t.booking.promoCode}` : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.user.email}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                        {eur(t.finalPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                            STATUS_STYLES[t.status]
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-bold text-slate-900 ${
          small ? "text-xs leading-relaxed" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
