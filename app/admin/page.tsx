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
            Admin console
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gated by <code className="rounded bg-slate-100 px-1.5 py-0.5">middleware.ts</code> —
            only ADMIN or SUPER_ADMIN reach this page.
          </p>

          {user ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Current user</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {user.email} · {user.role}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Manage users via <code>GET/PATCH /api/admin/users</code>.
              </p>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/routes"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Маршрути
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Конструктор шаблонів рейсів: зупинки, розклад по днях тижня,
                ціна, місткість автобуса.
              </p>
            </Link>
            <Link
              href="/admin/discounts"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Discounts
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Create and manage promo codes. Set percent, validity window,
                usage limit and per-user binding.
              </p>
            </Link>
            <Link
              href="/staff/tickets"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Квитки
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Пошук по всіх квитках: номер бронювання, ім'я, прізвище,
                телефон.
              </p>
            </Link>
            <Link
              href="/staff/trips"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Рейси
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Найближчі рейси, зупинки маршруту, список пасажирів.
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
                Список усіх акаунтів і призначення ролей.
              </p>
            </Link>
            <Link
              href="/admin/reports"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Звіти
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Продажі по агентах і напрямках, комісії, спосіб оплати,
                фільтри по періоду.
              </p>
            </Link>
            <Link
              href="/admin/agents"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Агенти
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Комісія (фіксована сума або %) та дозволи на /staff/**
                (квитки, рейси, позначення оплати) для кожного агента.
              </p>
            </Link>
            <Link
              href="/admin/discount-cards"
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                Дисконтні картки
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Персональні картки клієнтів з незмінною знижкою у %.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
