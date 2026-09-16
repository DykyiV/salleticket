import Header from "@/components/Header";
import CommissionManager from "@/components/admin/CommissionManager";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const carriers = await prisma.carrier.findMany({
    include: {
      commissionRules: { orderBy: [{ fromCity: "asc" }, { toCity: "asc" }] },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Carrier commissions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set the agency commission per carrier (default) and per route
            (override). Changes apply to future bookings only — commission
            snapshots on sold tickets and generated settlements never change.
          </p>

          <div className="mt-6">
            <CommissionManager carriers={carriers} />
          </div>
        </div>
      </main>
    </div>
  );
}
