import Link from "next/link";
import Header from "@/components/Header";
import TicketsBulkTable, {
  type BulkTicketRow,
} from "@/components/admin/TicketsBulkTable";
import { prisma } from "@/lib/db";
import { TicketStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

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

  const rows: BulkTicketRow[] = tickets.map((t) => ({
    id: t.id,
    reference: t.booking?.reference ?? t.id.slice(-8),
    passenger: t.booking ? `${t.booking.firstName} ${t.booking.lastName}` : "—",
    route: t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—",
    carrier: t.trip?.carrier.name ?? "—",
    bookedBy: t.user.email,
    price: eur(t.finalPrice),
    status: t.status,
    created: t.createdAt.toISOString().slice(0, 10),
  }));

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
            and its history. Select tickets with the checkboxes to print them
            as one PDF or send the same SMS to all selected passengers.
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

          <div className="mt-5">
            <TicketsBulkTable
              rows={rows}
              variant="tickets"
              emptyText="No tickets found."
            />
          </div>
        </div>
      </main>
    </div>
  );
}
