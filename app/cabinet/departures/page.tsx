import PageHeader from "@/components/cabinet/PageHeader";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { addUtcDays, toIsoDate, todayUtc, utcDateOnly } from "@/lib/routes/dates";
import { toDepartureDTO } from "@/lib/routes/serialize";
import { departureCapabilities, isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetDeparturesPage({
  searchParams,
}: {
  searchParams?: { templateId?: string; from?: string; to?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const from = searchParams?.from || toIsoDate(todayUtc());
  const to = searchParams?.to || toIsoDate(addUtcDays(todayUtc(), 60));
  const templateId = searchParams?.templateId;
  const admin = isAdminRole(user.role);

  const rows = await prisma.departure.findMany({
    where: {
      date: { gte: utcDateOnly(from), lte: utcDateOnly(to) },
      ...(templateId ? { templateId } : {}),
    },
    include: {
      template: { include: { country: true } },
      stops: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ date: "asc" }, { template: { name: "asc" } }],
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Виїзди"
        subtitle="Чекбокси біля маршрутів — сховати міста, змінити години або продаж місць на кількох виїздах одразу."
      />
      <DeparturesBoard
        mode={admin ? "admin" : "agent"}
        initialFrom={from}
        initialTo={to}
        initialTemplateId={templateId}
        initialDepartures={rows.map(toDepartureDTO)}
        capabilities={departureCapabilities(user)}
      />
    </div>
  );
}
