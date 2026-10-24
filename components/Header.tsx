import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import Icon from "@/components/site/Icon";
import LangSwitcher from "@/components/site/LangSwitcher";
import MobileMenu from "@/components/site/MobileMenu";
import { siteNav } from "@/components/site/nav";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
        <Icon name="bus" className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-navy">
        Asol<span className="text-brand-600"> BUS</span>
      </span>
    </Link>
  );
}

/** Public site header: logo, menu, language, «Мої квитки», «Купити квиток». */
export default async function Header() {
  const [user, { t }] = await Promise.all([getCurrentUser().catch(() => null), getDict()]);
  const nav = siteNav(t);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container-site flex h-16 items-center gap-3">
        <Logo />

        <nav aria-label={t.common.menu} className="ml-6 hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-slate-100 hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitcher className="hidden sm:inline-flex" />
          <Link
            href="/cabinet/tickets"
            className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-100 md:inline-flex"
          >
            <Icon name="ticket" className="h-4 w-4" />
            {t.common.myTickets}
          </Link>
          {user ? (
            <Link
              href="/cabinet"
              aria-label={t.common.cabinet}
              title={user.email}
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100 lg:inline-flex"
            >
              <Icon name="user" className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-slate-100 hover:text-navy lg:inline-flex"
            >
              {t.common.signIn}
            </Link>
          )}
          <Link href="/#search" className="btn-primary hidden px-4 py-2.5 text-sm sm:inline-flex">
            {t.common.buyTicket}
          </Link>
          <MobileMenu nav={nav} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
