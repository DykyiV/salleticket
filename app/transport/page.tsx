import Header from "@/components/Header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const carriers = await prisma.carrier.findMany({
    include: {
      routes: {
        where: { isActive: true },
        select: { busType: true, amenities: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Транспорт
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Автобуси наших перевізників — комфортні, сучасні, з
              кондиціонером та Wi-Fi на більшості напрямків.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {carriers.length === 0 ? (
            <p className="text-sm text-slate-500">
              <em>Інформація про перевізників з'явиться після налаштування маршрутів.</em>
            </p>
          ) : (
            <div className="space-y-4">
              {carriers.map((carrier) => {
                const busTypes = Array.from(
                  new Set(carrier.routes.map((r) => r.busType).filter(Boolean))
                );
                const amenities = Array.from(
                  new Set(
                    carrier.routes
                      .flatMap((r) => r.amenities.split(","))
                      .map((a) => a.trim())
                      .filter(Boolean)
                  )
                );
                return (
                  <div
                    key={carrier.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-900">
                        {carrier.name}
                      </p>
                      <span className="text-xs font-medium text-amber-700">
                        ★ {carrier.rating.toFixed(1)}
                      </span>
                    </div>
                    {busTypes.length > 0 ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {busTypes.join(", ")}
                      </p>
                    ) : null}
                    {amenities.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {amenities.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
