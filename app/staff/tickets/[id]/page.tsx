import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import AccessDenied from "@/components/staff/AccessDenied";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { hasStaffPermission } from "@/lib/auth/staffPermissions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
  REFUNDED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const SOURCE_LABELS: Record<string, string> = {
  BOOKING_FORM: "Форма бронювання (клієнт)",
  AGENT_BOOKING: "Агент (від імені клієнта)",
  ADMIN_PANEL: "Персонал / адмінка",
  ACCOUNT: "Особистий кабінет клієнта",
  API: "Зовнішній API",
  SYSTEM: "Система",
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Створено бронювання",
  CANCELLED: "Скасовано",
  REFUNDED_CASH: "Повернення готівкою",
  REFUNDED_ONLINE: "Повернення онлайн",
  PAYMENT_METHOD_SET: "Позначено спосіб оплати",
  STATUS_CHANGE: "Зміна статусу",
  STATUS_CONFIRMED: "Підтверджено поточний статус",
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "status": {"from":"RESERVED","to":"CANCELLED"} -> "status: RESERVED → CANCELLED" */
function formatChanges(raw: string | null): string[] {
  if (!raw) return [];
  let parsed: Record<string, { from: unknown; to: unknown }>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [raw];
  }
  return Object.entries(parsed).map(([field, { from, to }]) => {
    const fmt = (v: unknown) =>
      v === null || v === undefined
        ? "—"
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    return `${field}: ${fmt(from)} → ${fmt(to)}`;
  });
}

export default async function StaffTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session || !(await hasStaffPermission(session, "canAccessStaffTickets"))) {
    return <AccessDenied what="перегляд картки квитка" />;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      booking: true,
      user: { select: { id: true, email: true } },
      bookedBy: { select: { id: true, email: true } },
      refundedBy: { select: { id: true, email: true } },
      trip: { include: { carrier: true } },
      seat: true,
      history: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!ticket) notFound();

  // TicketHistory.changedBy is a plain userId string (no FK relation), so
  // resolve the emails for display in one extra query.
  const actorIds = Array.from(
    new Set(ticket.history.map((h) => h.changedBy).filter((id): id is string => Boolean(id)))
  );
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true },
      })
    : [];
  const actorEmail = new Map(actors.map((a) => [a.id, a.email]));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                STAFF
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Квиток {ticket.booking?.reference ?? ticket.id}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {ticket.trip ? (
                  <>
                    <Link
                      href={`/staff/trips/${ticket.trip.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {ticket.trip.fromCity} → {ticket.trip.toCity}
                    </Link>{" "}
                    · {ticket.trip.carrier.name}
                  </>
                ) : (
                  "Немає прив'язаного рейсу"
                )}
              </p>
            </div>
            <Link
              href="/staff/tickets"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Усі квитки
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Повна історія змін
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Кожна дія над квитком: хто, звідки (канал, IP, пристрій), коли
                і що саме змінив.
              </p>

              {ticket.history.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Історія порожня.</p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {ticket.history.map((h) => {
                    const who = h.changedBy
                      ? (actorEmail.get(h.changedBy) ?? h.changedBy)
                      : "Система";
                    const changes = formatChanges(h.changes);
                    return (
                      <li
                        key={h.id}
                        className="border-l-2 border-slate-200 pl-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {ACTION_LABELS[h.action] ?? h.action}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDateTime(h.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Хто: <span className="font-medium">{who}</span>
                          {h.source ? (
                            <>
                              {" "}
                              · Джерело:{" "}
                              <span className="font-medium">
                                {SOURCE_LABELS[h.source] ?? h.source}
                              </span>
                            </>
                          ) : null}
                        </p>
                        {(h.ipAddress || h.userAgent) ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {h.ipAddress ? `IP: ${h.ipAddress}` : null}
                            {h.ipAddress && h.userAgent ? " · " : null}
                            {h.userAgent ? `Пристрій: ${h.userAgent}` : null}
                          </p>
                        ) : null}
                        {changes.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {changes.map((line, i) => (
                              <li
                                key={i}
                                className="rounded bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-600"
                              >
                                {line}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Статус
                </p>
                <span
                  className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    STATUS_STYLES[ticket.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {ticket.status}
                </span>

                <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm">
                  <Row label="Пасажир" value={ticket.booking ? `${ticket.booking.firstName} ${ticket.booking.lastName}` : "—"} />
                  <Row label="Телефон" value={ticket.booking?.phone ?? "—"} />
                  <Row label="Власник акаунту" value={ticket.user.email} />
                  {ticket.bookedBy ? (
                    <Row label="Оформив агент" value={ticket.bookedBy.email} />
                  ) : null}
                  {ticket.seat ? (
                    <Row label="Місце" value={`№${ticket.seat.number}`} />
                  ) : null}
                  <Row label="Базова ціна" value={`€${ticket.basePrice.toFixed(2)}`} />
                  <Row label="До сплати" value={`€${ticket.finalPrice.toFixed(2)}`} />
                  {ticket.commissionAmount != null ? (
                    <Row label="Комісія агента" value={`€${ticket.commissionAmount.toFixed(2)}`} />
                  ) : null}
                  {ticket.paymentMethod ? (
                    <Row label="Спосіб оплати" value={ticket.paymentMethod} />
                  ) : null}
                  {ticket.refundAmount != null ? (
                    <>
                      <Row label="Повернено" value={`€${ticket.refundAmount.toFixed(2)}`} />
                      <Row label="Утримано" value={`€${(ticket.refundWithheld ?? 0).toFixed(2)}`} />
                      {ticket.refundedBy ? (
                        <Row label="Оформив повернення" value={ticket.refundedBy.email} />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
