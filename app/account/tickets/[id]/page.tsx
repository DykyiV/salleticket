import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import CancelTicketButton from "@/components/CancelTicketButton";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  RESERVED: "Заброньовано",
  PAID_ONLINE: "Оплачено онлайн",
  PAID_CASH: "Оплачено готівкою",
  CANCELLED: "Скасовано",
  REFUNDED: "Кошти повернено",
};

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
  REFUNDED: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Customer-facing summary of what happened — no IP/user-agent/staff
 * identity, just "what" and "when" in plain language. */
const EVENT_LABELS: Record<string, string> = {
  CREATED: "Бронювання створено",
  CANCELLED: "Бронювання скасовано",
  REFUNDED_CASH: "Кошти повернено готівкою",
  REFUNDED_ONLINE: "Кошти повернено онлайн",
  PAYMENT_METHOD_SET: "Оплату підтверджено",
  STATUS_CHANGE: "Статус змінено",
  STATUS_CONFIRMED: "Статус підтверджено",
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

export default async function AccountTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      booking: true,
      trip: { include: { carrier: true } },
      history: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!ticket) notFound();
  // A customer may only see their own ticket; staff can see any via /staff/tickets/[id].
  if (ticket.userId !== user.id && !hasRoleAtLeast(user.role, "ADMIN")) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Квиток {ticket.booking?.reference ?? ""}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {ticket.trip
                  ? `${ticket.trip.fromCity} → ${ticket.trip.toCity} · ${ticket.trip.carrier.name}`
                  : "Немає прив'язаного рейсу"}
              </p>
            </div>
            <Link
              href="/account"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад у кабінет
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                STATUS_STYLES[ticket.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
              }`}
            >
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ціна</span>
                <span className="font-medium text-slate-900">
                  €{ticket.finalPrice.toFixed(2)}
                </span>
              </div>
              {ticket.refundAmount != null ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Повернено</span>
                  <span className="font-medium text-slate-900">
                    €{ticket.refundAmount.toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>

            {ticket.status === "RESERVED" ? (
              <div className="mt-4">
                <CancelTicketButton ticketId={ticket.id} status="RESERVED" />
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Історія бронювання
            </h2>
            <ol className="mt-4 space-y-3">
              {ticket.history.map((h) => (
                <li key={h.id} className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm font-medium text-slate-900">
                    {EVENT_LABELS[h.action] ?? h.action}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(h.timestamp)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
