import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Консоль" },
  { href: "/admin/route-templates", label: "Шаблон маршрутів" },
  { href: "/admin/departures", label: "Виїзди" },
  { href: "/admin/users", label: "Користувачі" },
  { href: "/admin/discounts", label: "Знижки" },
];

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
};

export default function AdminShell({ title, subtitle, children, wide }: Props) {
  return (
    <div className={wide ? "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" : "mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"}>
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
        ADMIN
      </span>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
      <nav className="mt-4 flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
