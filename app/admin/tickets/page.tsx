import Link from "next/link";
import Header from "@/components/Header";
import { prisma } from "@/lib/db";
import { TicketStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

export const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-sky-50 text-sky-700 ring-sky-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-200",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "RESERVED", label: "Reserved" },
  { value: "PAID_ONLINE", label: "Paid online" },
  { value: "PAID_CASH", label: "Paid cash" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

export default async function TicketsPage(
  props: { searchParams: Promise<{ status?: string }> }
) {
  const searchParams = await props.searchParams;
  const statusFilter =
    searchParams.status && searchParams.status in TicketStatus
      ? (searchParams.status as TicketStatus)
      : undefined;

  const tickets = await prisma.ticket.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      booking: true,
      user: { select: { email: true } },
      trip: { include: { carrier: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All sold tickets. Open a ticket for full details, status changes
            and its history.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = (searchParams.status ?? "") === f.value;
              return (
                <Link
                  key={f.value}
                  href={f.value ? `/admin/tickets?status=${f.value}` : "/admin/tickets"}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Reference</Th>
                  <Th>Passenger</Th>
                  <Th>Route</Th>
                  <Th>Carrier</Th>
                  <Th>Booked by</Th>
                  <Th className="text-right">Price</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/tickets/${t.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {t.booking?.reference ?? t.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.booking
                          ? `${t.booking.firstName} ${t.booking.lastName}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t.trip?.carrier.name ?? "—"}
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
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {t.createdAt.toISOString().slice(0, 10)}
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
