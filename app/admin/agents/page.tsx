import Link from "next/link";
import Header from "@/components/Header";
import AgentsAdmin, { type AgentRow } from "@/components/admin/AgentsAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const rows = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "ADMIN", "SUPER_ADMIN"] } },
    select: {
      id: true,
      email: true,
      role: true,
      commissionType: true,
      commissionValue: true,
      canAccessStaffTickets: true,
      canAccessStaffTrips: true,
      canMarkPayments: true,
    },
    orderBy: { email: "asc" },
  });

  const agents: AgentRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    commissionType: r.commissionType,
    commissionValue: r.commissionValue,
    canAccessStaffTickets: r.canAccessStaffTickets,
    canAccessStaffTrips: r.canAccessStaffTrips,
    canMarkPayments: r.canMarkPayments,
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
                Агенти
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Комісія: фіксована сума за квиток або % від фінальної ціни —
                береться в момент бронювання й зберігається на квитку, зміна
                тут не впливає на вже оформлені квитки. Доступ до
                /staff/**: за замовчуванням агент не бачить жодної
                staff-сторінки, доки ви не увімкнете конкретний дозвіл —
                ADMIN/SUPER_ADMIN мають повний доступ завжди.
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
            <AgentsAdmin initialAgents={agents} />
          </div>
        </div>
      </main>
    </div>
  );
}
