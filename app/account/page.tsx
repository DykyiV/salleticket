import Link from "next/link";
import Header from "@/components/Header";
import LogoutButton from "@/components/LogoutButton";
import CancelTicketButton from "@/components/CancelTicketButton";
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

/**
 * Protected account page. The middleware already ensures an authenticated
 * user reaches this page; we still call getCurrentUser for fresh DB data.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();

  const tickets = user
    ? await prisma.ticket.findMany({
        where: { userId: user.id },
        include: {
          booking: true,
          trip: { include: { carrier: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Account
          </h1>

          {user ? (
            <div className="mt-6 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Role:{" "}
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                    {user.role}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Member since{" "}
                  {new Date(user.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Book a trip
                </Link>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/admin"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Admin console
                  </Link>
                )}
                {(user.role === "AGENT" ||
                  user.role === "ADMIN" ||
                  user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/agent"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Agent console
                  </Link>
                )}
                <LogoutButton />
              </div>
            </div>
          ) : null}

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">My tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your bookings. Reserved (unpaid) tickets can be cancelled here.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {tickets.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  No tickets yet —{" "}
                  <Link href="/" className="font-medium text-brand-700 hover:underline">
                    book your first trip
                  </Link>
                  .
                </p>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {t.trip
                          ? `${t.trip.fromCity} → ${t.trip.toCity}`
                          : "—"}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {t.booking?.reference}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.trip
                          ? `${t.trip.departureTime
                              .toISOString()
                              .slice(0, 16)
                              .replace("T", " ")} · ${t.trip.carrier.name} · ${
                              t.trip.transportType
                            }`
                          : ""}
                        {t.booking
                          ? ` · ${t.booking.firstName} ${t.booking.lastName}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {eur(t.finalPrice)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          STATUS_STYLES[t.status]
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.status === "RESERVED" ? (
                        <CancelTicketButton ticketId={t.id} />
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
