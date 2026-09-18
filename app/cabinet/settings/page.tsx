import PageHeader from "@/components/cabinet/PageHeader";
import UsersPermissions, {
  type UserRow,
} from "@/components/admin/UsersPermissions";
import DiscountsAdmin, {
  type DiscountRow,
} from "@/components/admin/DiscountsAdmin";
import SaleSettings from "@/components/admin/SaleSettings";
import TariffGrids, { type TariffCountry } from "@/components/admin/TariffGrids";
import RolePermissionsMatrix from "@/components/admin/RolePermissionsMatrix";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { parseMonthMultipliers, parseTiers } from "@/lib/pricing/grid";
import {
  PERMISSIONS,
  seedRolePermissions,
  type Permission,
} from "@/lib/auth/permissions";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetSettingsPage() {
  const [user, siteSettings] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
  ]);
  const isAdmin = user ? isAdminRole(user.role) : false;
  await seedRolePermissions();
  const [users, promos, countries, grids, grants] = await Promise.all([
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
    prisma.country.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tariffGrid.findMany(),
    prisma.rolePermission.findMany(),
  ]);

  const gridByCountry = new Map(grids.map((g) => [g.countryId, g]));
  const tariffCountries: TariffCountry[] = countries.map((country) => {
    const grid = gridByCountry.get(country.id);
    return {
      id: country.id,
      name: country.name,
      code: country.code,
      grid: grid
        ? {
            id: grid.id,
            capacity: grid.capacity,
            tiers: parseTiers(grid.tiers),
            monthMultipliers: parseMonthMultipliers(grid.monthMultipliers),
            earlyBirdDays: grid.earlyBirdDays,
            earlyBirdPercent: grid.earlyBirdPercent,
            lastMinuteDays: grid.lastMinuteDays,
            lastMinutePercent: grid.lastMinutePercent,
            minPrice: grid.minPrice,
            maxPrice: grid.maxPrice,
            isActive: grid.isActive,
          }
        : null,
    };
  });

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
      {isAdmin ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Тарифні сітки
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Одна сітка на країну — діє на всі її маршрути й виїзди. Ціна =
            рівень за часткою проданих місць × місячний коефіцієнт ×
            early-bird / last-minute, у межах мін/макс.
          </p>
          <TariffGrids countries={tariffCountries} />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Користувачі</h2>
        <UsersPermissions initialUsers={userRows} />
      </section>
      {isAdmin ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Дозволи ролей
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Матриця роль × дозвіл. Зміни зберігаються одразу і діють на API.
          </p>
          <RolePermissionsMatrix
            roles={Object.keys(Role) as Role[]}
            permissions={[...PERMISSIONS] as Permission[]}
            grants={grants.map((g) => ({
              role: g.role,
              permission: g.permission,
              allowed: g.allowed,
            }))}
          />
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Знижки</h2>
        <DiscountsAdmin initialDiscounts={discounts} />
      </section>
    </div>
  );
}
