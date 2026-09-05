import Link from "next/link";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await getCurrentUser();

  const bookedByMe = user
    ? await prisma.ticket.findMany({
        where: { bookedByUserId: user.id },
        include: { booking: true, trip: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
            AGENT
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Кабінет агента
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Гейт: <code className="rounded bg-slate-100 px-1.5 py-0.5">middleware.ts</code> —
            доступно ролям AGENT / ADMIN / SUPER_ADMIN.
          </p>

          {user ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Поточний користувач</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {user.email} · {user.role}
              </p>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              href="/"
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Забронювати для клієнта
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Знайдіть рейс і оформіть бронювання від імені клієнта, який
                телефонує чи прийшов особисто.
              </p>
            </Link>
            <Link
              href="/staff/tickets"
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Пошук квитків
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Знайти бронювання за номером, ім'ям, прізвищем або телефоном.
              </p>
            </Link>
            <Link
              href="/staff/trips"
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Рейси та манифест
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Список найближчих рейсів із зупинками та пасажирами.
              </p>
            </Link>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-900">
              Останні бронювання, оформлені вами
            </h2>
            {bookedByMe.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Ви ще не оформлювали бронювань для клієнтів.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-2">Квиток</th>
                      <th className="border-b border-slate-200 px-4 py-2">Пасажир</th>
                      <th className="border-b border-slate-200 px-4 py-2">Рейс</th>
                      <th className="border-b border-slate-200 px-4 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookedByMe.map((t) => (
                      <tr key={t.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border-t border-slate-100 px-4 py-2 font-mono">
                          {t.booking?.reference ?? "—"}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2">
                          {t.booking
                            ? `${t.booking.firstName} ${t.booking.lastName}`
                            : "—"}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2">
                          {t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—"}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-2">
                          {t.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
