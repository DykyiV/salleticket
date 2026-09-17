import Header from "@/components/Header";
import AdminShell from "@/components/admin/AdminShell";
import UsersPermissions, {
  type UserRow,
} from "@/components/admin/UsersPermissions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      canEditDepartures: true,
      canHideStops: true,
      canHideSeats: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: UserRow[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <AdminShell
          title="Користувачі та права"
          subtitle="Агенту можна дати право приховувати міста, місця для продажу або змінювати години виїзду."
        >
          <UsersPermissions initialUsers={rows} />
        </AdminShell>
      </main>
    </div>
  );
}
