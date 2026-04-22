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
          </div>
        </div>
      </main>
    </div>
  );
}
