import Link from "next/link";
import Header from "@/components/Header";
import DiscountsAdmin, {
  type DiscountRow,
} from "@/components/admin/DiscountsAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  const rows = await prisma.promo.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true } } },
  });

  const discounts: DiscountRow[] = rows.map((d) => ({
    id: d.id,
    code: d.code,
    type: d.type,
    percent: d.percent,
    amount: d.amount,
    label: d.label,
    isActive: d.isActive,
    startsAt: d.startsAt ? d.startsAt.toISOString() : null,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    userEmail: d.user?.email ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                ADMIN
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Discounts
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Create and manage promo codes applied during booking.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Back to admin
            </Link>
          </div>

          <div className="mt-6">
            <DiscountsAdmin initialDiscounts={discounts} />
          </div>
        </div>
      </main>
    </div>
  );
}
