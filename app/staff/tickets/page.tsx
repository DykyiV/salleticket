import Link from "next/link";
import Header from "@/components/Header";
import PaymentMethodCell from "@/components/staff/PaymentMethodCell";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = {
  reference?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function StaffTicketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reference, firstName, lastName, phone } = searchParams;
  const hasFilters = Boolean(reference || firstName || lastName || phone);

  const where: Prisma.BookingWhereInput = {};
  if (reference) where.reference = { contains: reference.trim() };
  if (firstName) where.firstName = { contains: firstName.trim() };
  if (lastName) where.lastName = { contains: lastName.trim() };
  if (phone) where.phone = { contains: phone.trim() };

  const bookings = hasFilters
    ? await prisma.booking.findMany({
        where,
        include: {
          ticket: {
            include: {
              trip: { include: { carrier: true } },
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : await prisma.booking.findMany({
        include: {
          ticket: {
            include: {
              trip: { include: { carrier: true } },
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                STAFF
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Квитки
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Пошук по всіх бронюваннях: номер квитка, ім'я, прізвище або
                телефон пасажира.
              </p>
            </div>
            <Link
              href="/agent"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад
            </Link>
          </div>

          <form
            method="GET"
            className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
          >
            <SearchField name="reference" label="Номер квитка" defaultValue={reference} />
            <SearchField name="firstName" label="Ім'я" defaultValue={firstName} />
            <SearchField name="lastName" label="Прізвище" defaultValue={lastName} />
            <SearchField name="phone" label="Телефон" defaultValue={phone} />
            <div className="sm:col-span-4 flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Знайти
              </button>
              {hasFilters ? (
                <Link
                  href="/staff/tickets"
                  className="text-sm text-slate-500 underline"
                >
                  Скинути фільтри
                </Link>
              ) : (
                <span className="text-xs text-slate-400">
                  Без фільтрів показані останні 50 бронювань.
                </span>
              )}
            </div>
          </form>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">Квиток</th>
                  <th className="border-b border-slate-200 px-4 py-3">Пасажир</th>
                  <th className="border-b border-slate-200 px-4 py-3">Телефон</th>
                  <th className="border-b border-slate-200 px-4 py-3">Рейс</th>
                  <th className="border-b border-slate-200 px-4 py-3">Дата</th>
                  <th className="border-b border-slate-200 px-4 py-3">Статус</th>
                  <th className="border-b border-slate-200 px-4 py-3">Оплата</th>
                  <th className="border-b border-slate-200 px-4 py-3">Ціна</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                      Нічого не знайдено.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="odd:bg-white even:bg-slate-50">
                      <td className="border-t border-slate-100 px-4 py-3">
                        <Link
                          href={
                            b.ticket.trip
                              ? `/staff/trips/${b.ticket.trip.id}`
                              : "#"
                          }
                          className="font-mono font-semibold text-brand-700 hover:underline"
                        >
                          {b.reference}
                        </Link>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {b.firstName} {b.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {b.ticket.user.email}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 tabular-nums">
                        {b.phone}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3">
                        {b.ticket.trip ? (
                          <>
                            <p className="text-slate-900">
                              {b.ticket.trip.fromCity} → {b.ticket.trip.toCity}
                            </p>
                            <p className="text-xs text-slate-500">
                              {b.ticket.trip.carrier.name}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3">
                        {b.ticket.trip ? formatDate(b.ticket.trip.departureTime) : "—"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3">
                        <StatusBadge status={b.ticket.status} />
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3">
                        <PaymentMethodCell
                          ticketId={b.ticket.id}
                          value={b.ticket.paymentMethod}
                        />
                      </td>
                      <td className="border-t border-slate-100 px-4 py-3 tabular-nums">
                        €{b.finalPrice.toFixed(2)}
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

function SearchField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded border border-slate-300 px-2"
      />
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID_ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID_CASH: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
  REFUNDED: "bg-rose-50 text-rose-700 ring-rose-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {status}
    </span>
  );
}
