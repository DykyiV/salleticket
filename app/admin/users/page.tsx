import Link from "next/link";
import Header from "@/components/Header";
import UsersAdmin, { type UserRow } from "@/components/admin/UsersAdmin";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser();

  const rows = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const users: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                ADMIN
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Користувачі
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Ролі. Призначити ADMIN або SUPER_ADMIN може лише SUPER_ADMIN
                — новому агенту після зміни ролі на AGENT ще потрібно
                видати дозволи на{" "}
                <Link href="/admin/agents" className="underline">
                  сторінці "Агенти"
                </Link>
                .
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад в адмінку
            </Link>
          </div>

          <div className="mt-6">
            <UsersAdmin
              initialUsers={users}
              currentUserId={currentUser?.id ?? ""}
              canAssignElevatedRoles={currentUser?.role === "SUPER_ADMIN"}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
