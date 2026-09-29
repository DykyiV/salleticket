import Link from "next/link";

const TABS = [
  { href: "/cabinet/finance", label: "Розрахунки з перевізниками" },
  { href: "/cabinet/finance/reconciliation", label: "Звірка" },
  { href: "/cabinet/finance/carrier-report", label: "Звіт перевізника" },
  { href: "/cabinet/finance/commissions", label: "Комісії" },
  { href: "/cabinet/finance/auto-reports", label: "Автозвіти" },
] as const;

/** Tab bar shared by the /cabinet/finance pages. */
export default function FinanceTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Фінанси" className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-sm">
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              active
                ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
