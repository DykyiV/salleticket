import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import PrintTicketButton from "@/components/ticket/PrintTicketButton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { formatTripMoment, toBoardingPass } from "@/lib/tickets/boardingPass";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";
import { eur, TICKET_STATUS_LABEL, TRIP_KIND_LABEL } from "@/lib/tickets/labels";
import { moneyState, priceBreakdown } from "@/lib/tickets/ticketMoney";

export const dynamic = "force-dynamic";

/**
 * Printed ticket — one A4 page, two columns like the ticket card: left the
 * passenger and the trip, right the status, number, QR code and price.
 */
export default async function PrintTicketPage(props: { params: Promise<{ reference: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          cashCollectedBy: { select: { email: true, displayName: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          history: { orderBy: { timestamp: "desc" }, select: { newStatus: true, timestamp: true } },
          legs: { orderBy: { order: "asc" }, include: { assignment: { include: { bus: true } } } },
          trip: { include: { carrier: true, departure: { include: { stops: true, template: true, bus: true } } } },
          returnTrip: { include: { carrier: true, departure: { include: { stops: true, template: true } } } },
        },
      },
    },
  });
  if (!booking) notFound();
  if (booking.ticket.userId !== user.id && !hasRoleAtLeast(user.role, "AGENT")) notFound();

  const ticket = booking.ticket;
  const returnTrip = ticket.returnTrip;
  const pass = toBoardingPass(booking);

  const h = await headers();
  const qr = await qrCodeDataUrl(
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}/check/${booking.reference}`
  );

  const payment = ticket.payments[0] ?? null;
  const livePayment = payment && ["PENDING", "SENT", "SETTLED"].includes(payment.status) ? payment : null;
  const price = priceBreakdown({
    basePrice: ticket.basePrice,
    finalPrice: ticket.finalPrice,
    ageCategory: booking.ageCategory,
    promoCode: booking.promoCode,
    onlinePayment: livePayment,
  });
  const money = moneyState({
    status: ticket.status,
    finalPrice: ticket.finalPrice,
    payment: livePayment,
    cashCollector: ticket.cashCollectedBy ? ticket.cashCollectedBy.displayName ?? ticket.cashCollectedBy.email : null,
    cashCollectedAt: ticket.cashCollectedAt,
    statusSince: ticket.history.find((row) => row.newStatus === ticket.status)?.timestamp ?? null,
  });
  const moneyClass =
    money.tone === "paid"
      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
      : money.tone === "due"
        ? "border-amber-500 bg-amber-50 text-amber-900"
        : "border-slate-400 bg-slate-50 text-slate-700";

  return (
    <main className="mx-auto min-h-screen max-w-[210mm] bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <style>{"@page { size: A4; margin: 10mm } @media print { html, body { background: #fff } }"}</style>
      <div className="rounded-2xl border border-slate-300 p-5 print:rounded-none print:border-black">
        <header className="flex items-center justify-between border-b border-slate-200 pb-3">
          <p className="text-sm font-bold tracking-wide">
            Asol <span className="text-brand-600 print:text-black">BUS</span>
            <span className="ml-2 font-normal text-slate-500">· посадковий талон</span>
          </p>
          <p className="text-xs text-slate-500">{TRIP_KIND_LABEL[ticket.tripKind] ?? ticket.tripKind}</p>
        </header>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_62mm] gap-5">
          {/* Left: passenger + trip */}
          <div className="space-y-4 text-sm">
            <section>
              <p className="text-lg font-semibold">{pass.passengerName}</p>
              <p className="text-slate-600">{pass.phones.join(" · ")}</p>
            </section>
            <section>
              <p className="text-lg font-semibold">
                {pass.fromCity} → {pass.toCity}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Виїзд</p>
                  <p className="text-lg font-bold tabular-nums">{pass.departureLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Прибуття</p>
                  <p className="text-lg font-bold tabular-nums">{pass.arrivalLabel}</p>
                </div>
              </div>
            </section>
            <section className="border-t border-slate-200 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Місце посадки</p>
              <p className="font-medium">{pass.boardingPlace}</p>
              {pass.coordinates ? <p className="text-xs tabular-nums text-slate-600">{pass.coordinates}</p> : null}
              {pass.mapsUrl ? <p className="break-all text-xs text-slate-600">{pass.mapsUrl}</p> : null}
            </section>
            <section className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Номер автобуса</p>
                <p className="text-xl font-bold">{pass.busNumber}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Місце</p>
                <p className="text-xl font-bold">{pass.seatLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Телефон автобуса</p>
                <p className="font-medium">{pass.busPhone}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Диспетчер</p>
                <p className="font-medium">{pass.dispatcherPhone}</p>
              </div>
            </section>
            {returnTrip || (ticket.tripKind === "OPEN_RETURN" && !returnTrip) ? (
              <section className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Назад</p>
                {returnTrip ? (
                  <p>
                    {returnTrip.fromCity} → {returnTrip.toCity} · {formatTripMoment(returnTrip.departureTime)}
                    {ticket.returnSeatNumber != null ? ` · місце ${ticket.returnSeatNumber}` : ""}
                  </p>
                ) : (
                  <p>Відкрита дата</p>
                )}
              </section>
            ) : null}
          </div>

          {/* Right: status, number, QR, price */}
          <aside className="space-y-3 text-sm">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase">{TICKET_STATUS_LABEL[ticket.status]}</p>
              <p className="mt-1 font-mono text-xl font-bold tracking-widest">{booking.reference}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR-код ${booking.reference}`} className="mx-auto mt-2 h-[44mm] w-[44mm]" />
              <p className="text-[10px] text-slate-500">Покажіть QR водієві при посадці</p>
            </div>
            <div className="border-t border-slate-200 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Тариф</span>
                <span className="tabular-nums">{eur(price.base)}</span>
              </div>
              {price.discounts.map((d) => (
                <div key={d.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{d.label}</span>
                  <span className="tabular-nums">−{eur(d.amount)}</span>
                </div>
              ))}
              <div className={`mt-2 rounded-lg border px-2 py-1.5 ${moneyClass}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold">{money.label}</span>
                  <span className="text-lg font-bold tabular-nums">{eur(money.amount)}</span>
                </div>
                {money.note ? <p className="text-[10px] leading-tight opacity-80">{money.note}</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <PrintTicketButton />
        <Link
          href={`/cabinet/tickets/${booking.reference}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Назад до квитка
        </Link>
      </div>
    </main>
  );
}
