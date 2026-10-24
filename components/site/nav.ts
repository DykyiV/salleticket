import type { Dict } from "@/lib/i18n/dict";

export type SiteNavItem = { href: string; label: string };

export function siteNav(t: Dict): SiteNavItem[] {
  return [
    { href: "/results", label: t.nav.trips },
    { href: "/#directions", label: t.nav.directions },
    { href: "/baggage", label: t.nav.baggage },
    { href: "/rules", label: t.nav.rules },
    { href: "/#support", label: t.nav.support },
  ];
}
