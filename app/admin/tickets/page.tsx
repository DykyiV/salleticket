import Link from "next/link";
import Header from "@/components/Header";
import TicketsBulkTable, {
  type BulkTicketRow,
} from "@/components/admin/TicketsBulkTable";
import { prisma } from "@/lib/db";
import { Prisma, TicketStatus } from "@prisma/client";

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

function buildQuery(params: { status?: string; q?: string; carrier?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.carrier) sp.set("carrier", params.carrier);
  const s = sp.toString();
  return s ? `/admin/tickets?${s}` : "/admin/tickets";
}

export default async function TicketsPage(
  props: {
    searchParams: Promise<{ status?: string; q?: string; carrier?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const statusFilter =
    searchParams.status && searchParams.status in TicketStatus
      ? (searchParams.status as TicketStatus)
      : undefined;
  const q = (searchParams.q ?? "").trim();
  const carrierFilter = (searchParams.carrier ?? "").trim();

  const where: Prisma.TicketWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(carrierFilter
      ? { trip: { carrier: { name: carrierFilter } } }
      : {}),
    ...(q
      ? {
          OR: [
            { booking: { reference: { contains: q } } },
            { booking: { firstName: { contains: q } } },
            { booking: { lastName: { contains: q } } },
            { booking: { phone: { contains: q } } },
            { booking: { email: { contains: q } } },
          ],
        }
      : {}),
  };

  const [tickets, carriers] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        booking: true,
        user: { select: { email: true } },
        trip: { include: { carrier: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.carrier.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
            All sold tickets, newest first. Click the passenger name to open
            the ticket. Select tickets with the checkboxes to print them as
            one PDF or send the same SMS to all selected passengers.
          </p>

          <form
            method="GET"
            action="/admin/tickets"
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Пошук: референс, ПІБ, телефон, email…"
              className="w-72 rounded-xl border-0 px-3.5 py-2 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            />
            <select
              name="carrier"
              defaultValue={carrierFilter}
              className="rounded-xl border-0 bg-white px-3.5 py-2 text-sm text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Всі перевізники</option>
              {carriers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Знайти
            </button>
            {q || carrierFilter ? (
              <Link
                href={buildQuery({ status: searchParams.status })}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                Скинути
              </Link>
            ) : null}
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = (searchParams.status ?? "") === f.value;
              return (
                <Link
                  key={f.value}
                  href={buildQuery({
                    status: f.value || undefined,
                    q: q || undefined,
                    carrier: carrierFilter || undefined,
                  })}
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
