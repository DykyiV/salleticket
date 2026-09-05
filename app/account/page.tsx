import Link from "next/link";
import Header from "@/components/Header";
import LogoutButton from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Protected account page. The middleware already ensures an authenticated
 * user reaches this page; we still call getCurrentUser for fresh DB data.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            This page is protected by the middleware — only signed-in users can view it.
          </p>

          {user ? (
            <div className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Role:{" "}
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                    {user.role}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Member since{" "}
                  {new Date(user.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Book a trip
                </Link>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/admin"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Admin console
                  </Link>
                )}
                {(user.role === "AGENT" ||
                  user.role === "ADMIN" ||
                  user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/agent"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Agent console
                  </Link>
                )}
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
