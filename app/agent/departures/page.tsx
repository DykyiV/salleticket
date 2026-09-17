import Link from "next/link";
import Header from "@/components/Header";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { departureCapabilities } from "@/lib/routes/permissions";
import { addUtcDays, toIsoDate, todayUtc, utcDateOnly } from "@/lib/routes/dates";
import { toDepartureDTO } from "@/lib/routes/serialize";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentDeparturesPage() {
  const sessionUser = await getCurrentUser();
  const dbUser = sessionUser
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          role: true,
          canEditDepartures: true,
          canHideStops: true,
          canHideSeats: true,
        },
      })
    : null;

  const caps = departureCapabilities(
    dbUser ?? {
      role: "AGENT",
      canEditDepartures: false,
      canHideStops: false,
      canHideSeats: false,
    }
  );

  const from = toIsoDate(todayUtc());
  const to = toIsoDate(addUtcDays(todayUtc(), 60));
  const rows = await prisma.departure.findMany({
    where: { date: { gte: utcDateOnly(from), lte: utcDateOnly(to) } },
    include: {
      template: { include: { country: true } },
      stops: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ date: "asc" }, { template: { name: "asc" } }],
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
            AGENT
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Виїзди
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Перегляд графіка і посадки. Редагування доступне, якщо адмін надав права.
          </p>
          <div className="mt-3">
            <Link
              href="/agent"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Назад до кабінету агента
            </Link>
          </div>
          <div className="mt-6">
            <DeparturesBoard
              mode="agent"
              initialFrom={from}
              initialTo={to}
              initialDepartures={rows.map(toDepartureDTO)}
              capabilities={caps}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
