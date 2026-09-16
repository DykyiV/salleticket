import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import TicketsBulkTable, {
  type BulkTicketRow,
} from "@/components/admin/TicketsBulkTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

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

  const rows: BulkTicketRow[] = trip.tickets.map((t) => ({
    id: t.id,
    reference: t.booking?.reference ?? t.id.slice(-8),
    passenger: t.booking ? `${t.booking.firstName} ${t.booking.lastName}` : "—",
    type: `${t.booking?.ageCategory ?? "—"}${
      t.booking?.promoCode ? ` · ${t.booking.promoCode}` : ""
    }`,
    bookedBy: t.user.email,
    price: eur(t.finalPrice),
    status: t.status,
    created: t.createdAt.toISOString().slice(0, 10),
  }));

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

          <div className="mt-6">
            <TicketsBulkTable
              rows={rows}
              variant="departure"
              emptyText="No tickets on this departure yet."
            />
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
