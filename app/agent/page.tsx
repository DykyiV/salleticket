import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";
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

export default async function AgentPage() {
  const user = await getCurrentUser();

  // Visibility rule: an agent sees only tickets booked under their own
  // account, unless an admin granted "view all passengers' tickets" on the
  // Users tab (or the user is an admin, who always sees everything).
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const seesAll = Boolean(user && (isAdmin || user.canViewAllTickets));

  const tickets = user
    ? await prisma.ticket.findMany({
        where: seesAll ? undefined : { userId: user.id },
        include: {
          booking: true,
          user: { select: { email: true } },
          trip: { include: { carrier: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
            AGENT
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Agent console
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {seesAll ? (
              <>
                You see <strong>all passengers&apos; tickets</strong>
                {isAdmin
                  ? " (admin access)."
                  : " — granted by an administrator on the Users tab."}
              </>
            ) : (
              <>
                You see only <strong>tickets booked under your account</strong>.
                An administrator can grant access to all passengers&apos;
                tickets on the Users tab.
              </>
            )}
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Reference</Th>
                  <Th>Passenger</Th>
                  <Th>Route</Th>
                  <Th>Carrier</Th>
                  {seesAll ? <Th>Booked by</Th> : null}
                  <Th className="text-right">Price</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={seesAll ? 8 : 7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                      No tickets to show.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.booking?.reference ?? t.id.slice(-8)}
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
                      {seesAll ? (
                        <td className="px-4 py-3 text-slate-500">{t.user.email}</td>
                      ) : null}
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
