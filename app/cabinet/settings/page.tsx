import PageHeader from "@/components/cabinet/PageHeader";
import UsersPermissions, {
  type UserRow,
} from "@/components/admin/UsersPermissions";
import DiscountsAdmin, {
  type DiscountRow,
} from "@/components/admin/DiscountsAdmin";
import SaleSettings from "@/components/admin/SaleSettings";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetSettingsPage() {
  const [user, siteSettings] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
  ]);
  const isAdmin = user ? isAdminRole(user.role) : false;
  const [users, promos] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.promo.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const userRows: UserRow[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  const discounts: DiscountRow[] = promos.map((d) => ({
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
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Налаштування"
        subtitle="Користувачі, права агентів, продаж і промокоди."
      />
      {isAdmin ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Продаж квитків
          </h2>
          <SaleSettings initial={siteSettings} />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Користувачі</h2>
        <UsersPermissions initialUsers={userRows} />
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Знижки</h2>
        <DiscountsAdmin initialDiscounts={discounts} />
      </section>
    </div>
  );
}
