import Link from "next/link";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Адмін-консоль
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Шаблони маршрутів, виїзди, права агентів і знижки.
          </p>

          {user ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Поточний користувач</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {user.email} · {user.role}
              </p>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/route-templates"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Шаблон маршрутів
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Країни, дні виїзду, графік міст, посадка, генерація виїздів на рік.
              </p>
            </Link>
            <Link
              href="/admin/departures"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Виїзди
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Чекбокси, масове приховування міст і місць, зміна годин по сезону.
              </p>
            </Link>
            <Link
              href="/admin/users"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Користувачі
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Права агента на приховування міст і місць для продажу.
              </p>
            </Link>
            <Link
              href="/admin/discounts"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Знижки
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Промокоди: відсоток, період, ліміт використань.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
