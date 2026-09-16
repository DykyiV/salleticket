import Header from "@/components/Header";
import UsersManager from "@/components/admin/UsersManager";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [currentUser, users] = await Promise.all([
    getCurrentUser(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        canViewAllTickets: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage roles and agent permissions. The toggle controls whether an
            agent sees all passengers&apos; tickets in the agent console or
            only tickets booked under their own account. Assigning ADMIN /
            SUPER_ADMIN roles requires SUPER_ADMIN.
          </p>

          <div className="mt-6">
            <UsersManager
              users={users}
              currentUserId={currentUser?.id ?? ""}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
