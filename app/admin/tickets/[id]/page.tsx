import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import PassengerEditor from "@/components/PassengerEditor";
import TicketStatusControl from "@/components/admin/TicketStatusControl";
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

const AGE_LABELS: Record<string, string> = {
  CHILD_0_4: "Child 0–4",
  CHILD_5_12: "Child 5–12",
  ADULT: "Adult",
  SENIOR_60: "Senior 60+",
};

export default async function TicketDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      booking: true,
      user: { select: { email: true, role: true } },
      trip: { include: { carrier: true } },
      history: { orderBy: { timestamp: "desc" } },
      settlement: { select: { invoiceNumber: true, period: true, status: true } },
    },
  });
  if (!ticket) notFound();

  const booking = ticket.booking;
  const trip = ticket.trip;
  const discount =
    ticket.basePrice > ticket.finalPrice
      ? ticket.basePrice - ticket.finalPrice
      : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/admin/tickets"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            ← All tickets
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Ticket {booking?.reference ?? ticket.id.slice(-8)}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                STATUS_STYLES[ticket.status]
              }`}
            >
              {ticket.status}
            </span>
            <a
              href={`/api/tickets/${ticket.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              ⬇ PDF ticket
            </a>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {ticket.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            {trip ? ` · ${trip.transportType}` : ""}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Passenger">
              <Row label="Name" value={booking ? `${booking.firstName} ${booking.lastName}` : "—"} />
              <Row label="Phone" value={booking?.phone ?? "—"} />
              <Row label="Email" value={booking?.email ?? "—"} />
              <Row
                label="Ticket type"
                value={
                  booking
                    ? `${AGE_LABELS[booking.ageCategory] ?? booking.ageCategory}${
                        booking.promoCode ? ` · promo ${booking.promoCode}` : ""
                      }`
                    : "—"
                  }
              />
              {booking ? (
                <div className="mt-2">
                  <PassengerEditor
                    ticketId={ticket.id}
                    passenger={{
                      firstName: booking.firstName,
                      lastName: booking.lastName,
                      phone: booking.phone,
                      email: booking.email,
                    }}
                  />
                </div>
              ) : null}
            </Section>

            <Section title="Trip">
              <Row
                label="Route"
                value={trip ? `${trip.fromCity} → ${trip.toCity}` : "—"}
              />
              <Row
                label="Departure"
                value={trip ? trip.departureTime.toISOString().slice(0, 16).replace("T", " ") : "—"}
              />
              <Row
                label="Arrival"
                value={trip ? trip.arrivalTime.toISOString().slice(0, 16).replace("T", " ") : "—"}
              />
              <Row label="Carrier" value={trip?.carrier.name ?? "—"} />
              <Row label="Booked by" value={`${ticket.user.email} (${ticket.user.role})`} />
            </Section>

            <Section title="Payment">
              <Row label="Base price" value={eur(ticket.basePrice)} />
              <Row
                label="Discount"
                value={discount > 0 ? `−${eur(discount)}` : "—"}
              />
              <Row label="Final price" value={eur(ticket.finalPrice)} highlight />
              <Row
                label="Agency commission"
                value={
                  ticket.commissionAmount != null
                    ? `${eur(ticket.commissionAmount)} (${ticket.commissionPercent}%)`
                    : "—"
                }
              />
              <Row
                label="Carrier share"
                value={ticket.carrierAmount != null ? eur(ticket.carrierAmount) : "—"}
              />
              <Row
                label="Settlement"
                value={
                  ticket.settlement
                    ? `${ticket.settlement.invoiceNumber} (${ticket.settlement.status})`
                    : "not invoiced"
                }
              />
            </Section>

            <Section title="Change status">
              <TicketStatusControl
                ticketId={ticket.id}
                currentStatus={ticket.status}
              />
              <p className="mt-3 text-xs text-slate-400">
                Paid online → money with the agency; paid cash → money with
                the carrier. This drives the settlement balance.
              </p>
            </Section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <h2 className="text-base font-semibold text-slate-900">History</h2>
            {ticket.history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No history entries.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {ticket.history.map((h) => (
                  <li key={h.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="tabular-nums text-slate-500">
                        {h.timestamp.toISOString().slice(0, 16).replace("T", " ")}
                      </span>
                      <span className="font-medium text-slate-900">{h.action}</span>
                      {h.oldStatus || h.newStatus ? (
                        <span className="text-slate-600">
                          {h.oldStatus ?? "—"} → {h.newStatus ?? "—"}
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-400">
                        {h.source ?? "—"}
                        {h.changedBy ? ` · by ${h.changedBy}` : ""}
                        {h.ipAddress ? ` · ${h.ipAddress}` : ""}
                      </span>
                    </div>
                    <ChangeDiff changes={h.changes} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/** Render the JSON field diff stored on a history row, e.g. after a
 *  passenger edit: "phone: +380… → +380…". */
function ChangeDiff({ changes }: { changes: string | null }) {
  if (!changes) return null;
  let parsed: Record<string, { from: unknown; to: unknown }>;
  try {
    parsed = JSON.parse(changes);
  } catch {
    return null;
  }
  // Status transitions are already shown via the old → new badges above.
  const entries = Object.entries(parsed).filter(([field]) => field !== "status");
  if (entries.length === 0) return null;
  const fmt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
  return (
    <ul className="mt-1 flex flex-col gap-0.5 pl-1 text-xs text-slate-500">
      {entries.map(([field, { from, to }]) => (
        <li key={field}>
          <span className="font-medium text-slate-600">{field}</span>:{" "}
          {fmt(from)} → {fmt(to)}
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <dl className="mt-4 flex flex-col gap-2.5">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right ${
          highlight ? "text-base font-bold text-slate-900" : "font-medium text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
