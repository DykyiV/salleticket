import Link from "next/link";
import Header from "@/components/Header";
import RoutesAdmin, { type RouteRow } from "@/components/admin/RoutesAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminRoutesPage() {
  const rows = await prisma.route.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      carrier: { select: { id: true, name: true } },
      stops: { orderBy: { order: "asc" } },
    },
  });

  const routes: RouteRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    fromCity: r.fromCity,
    toCity: r.toCity,
    carrierId: r.carrier.id,
    carrierName: r.carrier.name,
    departureTime: r.departureTime,
    daysOfWeek: r.daysOfWeek,
    basePrice: r.basePrice,
    busCapacity: r.busCapacity,
    busType: r.busType,
    amenities: r.amenities,
    isActive: r.isActive,
    stops: r.stops.map((s) => ({
      city: s.city,
      address: s.address,
      offsetMinutes: s.offsetMinutes,
      isPickup: s.isPickup,
      isDropoff: s.isDropoff,
    })),
    createdAt: r.createdAt.toISOString(),
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
                Конструктор маршрутів
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Шаблони рейсів: напрямок, зупинки, розклад по днях тижня,
                ціна й місткість. Активні маршрути автоматично генерують
                конкретні рейси на найближчі 30 днів.
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
            <RoutesAdmin initialRoutes={routes} />
          </div>
        </div>
      </main>
    </div>
  );
}
