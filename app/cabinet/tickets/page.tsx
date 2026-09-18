import Link from "next/link";
import { Prisma, TicketStatus } from "@prisma/client";
import PageHeader from "@/components/cabinet/PageHeader";
import { inputClass, btnGhost } from "@/components/admin/Field";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import {
  bookedByLabel,
  eur,
  paidAmount,
  TICKET_STATUS_CLASS,
  TICKET_STATUS_LABEL,
} from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

const STATUSES: TicketStatus[] = [
  "RESERVED",
  "PAID_ONLINE",
  "PAID_CASH",
  "CANCELLED",
  "REFUNDED",
];

export default async function CabinetTicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const user = await getCurrentUser();
  const staff = user ? hasRoleAtLeast(user.role, "AGENT") : false;
  const q = (searchParams.q ?? "").trim();
  const statusFilter =
    searchParams.status && STATUSES.includes(searchParams.status as TicketStatus)
      ? (searchParams.status as TicketStatus)
      : undefined;

  const ticketWhere: Prisma.TicketWhereInput = {
    ...(user && !staff ? { userId: user.id } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };
  const where: Prisma.BookingWhereInput = {
    ...(Object.keys(ticketWhere).length ? { ticket: ticketWhere } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const bookings = user
    ? await prisma.booking.findMany({
        where,
        include: {
          ticket: {
            include: {
              user: { select: { email: true, displayName: true } },
              trip: { include: { carrier: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Квитки"
        subtitle={
          staff
            ? "Один квиток — один рядок. Натисніть ПІБ, щоб відкрити квиток."
            : "Ваші бронювання. Натисніть ПІБ, щоб відкрити квиток."
        }
      />

      <form
        method="GET"
        action="/cabinet/tickets"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Пошук</span>
          <input
            className={`${inputClass} w-64`}
            name="q"
            defaultValue={q}
            placeholder="ПІБ, код, телефон…"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">Статус</span>
          <select
            className={`${inputClass} w-52`}
            name="status"
            defaultValue={statusFilter ?? ""}
          >
            <option value="">Усі статуси</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {TICKET_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnGhost}>
          Показати
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          Квитків не знайдено.{" "}
          <Link href="/" className="text-brand-700 underline">
            Знайти рейс
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5">ПІБ</th>
                <th className="whitespace-nowrap px-4 py-2.5">Звідки — куди</th>
                <th className="whitespace-nowrap px-4 py-2.5">Телефон</th>
                <th className="whitespace-nowrap px-4 py-2.5">Перевізник</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right">Ціна</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right">Оплачено</th>
                <th className="whitespace-nowrap px-4 py-2.5">Хто бронював</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const trip = booking.ticket.trip;
                const status = booking.ticket.status;
                const price = booking.finalPrice;
                const paid = paidAmount(status, price);
                const name = `${booking.lastName} ${booking.firstName}`.trim();
                return (
                  <tr
                    key={booking.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link
                        href={`/cabinet/tickets/${booking.reference}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {name}
                      </Link>
                      <span
                        className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TICKET_STATUS_CLASS[status]}`}
                      >
                        {TICKET_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                      {trip ? `${trip.fromCity} — ${trip.toCity}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">
                      {booking.phone}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                      {trip?.carrier?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-900">
                      {eur(price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      <span
                        className={
                          paid > 0 ? "font-medium text-emerald-700" : "text-slate-500"
                        }
                      >
                        {eur(paid)}
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-slate-600">
                      {bookedByLabel(booking.ticket.user)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
