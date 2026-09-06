import Link from "next/link";
import Header from "@/components/Header";
import DiscountCardsAdmin, {
  type DiscountCardRow,
} from "@/components/admin/DiscountCardsAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDiscountCardsPage() {
  const rows = await prisma.discountCard.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true } } },
  });

  const cards: DiscountCardRow[] = rows.map((c) => ({
    id: c.id,
    code: c.code,
    percent: c.percent,
    isActive: c.isActive,
    usedCount: c.usedCount,
    source: c.source,
    userEmail: c.user?.email ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                ADMIN
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Дисконтні картки
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Персональна незмінна знижка для конкретного клієнта —
                застосовується до кожного бронювання, без терміну дії й
                ліміту використань (на відміну від промокодів).
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
            <DiscountCardsAdmin initialCards={cards} />
          </div>
        </div>
      </main>
    </div>
  );
}
