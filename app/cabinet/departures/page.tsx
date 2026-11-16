import Link from "next/link";
import PageHeader from "@/components/cabinet/PageHeader";
import DeparturesBoard from "@/components/admin/DeparturesBoard";
import DepartureBoard from "@/components/departures/DepartureBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { listBoardDepartures } from "@/lib/departures/board";
import { kyivToday } from "@/lib/tickets/changeRules";
import {
  listDepartureFilterOptions,
  listDepartures,
} from "@/lib/routes/listDepartures";
import { departureCapabilities, isAdminRole } from "@/lib/routes/permissions";

export const dynamic = "force-dynamic";

export default async function CabinetDeparturesPage(
  props: {
    searchParams?: Promise<{
      templateId?: string;
      countryId?: string;
      from?: string;
      to?: string;
      page?: string;
      tab?: string;
      route?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "AGENT")) return null;

  const tabs = (
    <nav className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
      {[
        { key: "", label: "Усі виїзди" },
        { key: "own", label: "Наші рейси (керування)" },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.key ? `/cabinet/departures?tab=${t.key}` : "/cabinet/departures"}
          className={`-mb-px border-b-2 px-3 py-2 font-medium ${
            (searchParams?.tab ?? "") === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (searchParams?.tab !== "own") {
    const today = kyivToday();
    const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const from = valid(searchParams?.from) ?? today;
    const plus = (day: string, n: number) => {
      const d = new Date(`${day}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    // At most two months at once: GT returns the whole period in one answer.
    const asked = valid(searchParams?.to) ?? plus(today, 30);
    const to = asked < from ? from : asked > plus(from, 62) ? plus(from, 62) : asked;
    const departures = await listBoardDepartures({ sub: user.id, role: user.role }, from, to);
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Виїзди"
          subtitle="Рейси всіх перевізників, які ми продаємо (зараз Grandes Tour). Натисніть на маршрут — пасажири, автобус і схема салону."
        />
        {tabs}
        <DepartureBoard departures={departures} from={from} to={to} today={today} initialRoute={searchParams?.route} />
      </div>
    );
  }

  const admin = isAdminRole(user.role);
  const capabilities = departureCapabilities(user);
  const [list, filters] = await Promise.all([
    listDepartures({
      from: searchParams?.from,
      to: searchParams?.to,
      templateId: searchParams?.templateId,
      countryId: searchParams?.countryId,
      page: searchParams?.page,
    }),
    listDepartureFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Виїзди"
        subtitle={
          capabilities.canBulk
            ? "Фільтр за країною, маршрутом і датами. Масове редагування — для адміна або агента з правом."
            : "Фільтр за країною, маршрутом і датами. Усі напрямки на місяць уперед, по 15 на сторінку."
        }
      />
      {tabs}
      <DeparturesBoard
        mode={admin ? "admin" : "agent"}
        initialFrom={list.from}
        initialTo={list.to}
        initialTemplateId={searchParams?.templateId}
        initialCountryId={searchParams?.countryId}
        initialPage={list.page}
        initialTotal={list.total}
        initialTotalPages={list.totalPages}
        initialDepartures={list.departures}
        countries={filters.countries}
        routes={filters.routes}
        capabilities={capabilities}
      />
    </div>
  );
}
