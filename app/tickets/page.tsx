import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import { StatePill } from "@/components/ticket/ETicketCard";
import { isTicketStaff } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { Lang } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dict";
import { getDict } from "@/lib/i18n/server";
import { longDate, money, plural } from "@/lib/i18n/format";
import { ETICKET_INCLUDE, siteOrigin, toETicket, type ETicket, type ETicketState } from "@/lib/tickets/eTicket";
import { cityLabel } from "@/lib/trips/cities";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.ticket.listTitle} — Asol BUS`, robots: { index: false } };
}

type Order = { key: string; tickets: ETicket[]; departAt: string | null; state: ETicketState; total: number };

const RANK: Record<ETicketState, number> = { due: 0, pending: 1, paid: 2, refunded: 3, cancelled: 4 };

function todayInEurope(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** «Мої квитки» for passengers: orders grouped, upcoming first. Staff use the cabinet list. */
export default async function MyTicketsPage() {
  const [{ t, lang }, user] = await Promise.all([getDict(), getCurrentUser()]);
  const tt = t.ticket;

  if (user && (await isTicketStaff({ role: user.role }))) redirect("/cabinet/tickets");

  let upcoming: Order[] = [];
  let past: Order[] = [];
  if (user) {
    const rows = await prisma.booking.findMany({
      where: { ticket: { userId: user.id } },
      include: ETICKET_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const origin = siteOrigin(null);
    const byKey = new Map<string, ETicket[]>();
    for (const b of rows) {
      const key = b.groupRef ?? b.reference;
      byKey.set(key, [...(byKey.get(key) ?? []), toETicket(b, origin)]);
    }
    const today = todayInEurope();
    for (const [key, tickets] of byKey) {
      tickets.sort((a, b) => a.reference.localeCompare(b.reference));
      const live = tickets.filter((e) => e.state !== "cancelled" && e.state !== "refunded");
      const departAt = tickets[0].journeys[0]?.departAt ?? null;
      const state = (live.length ? live : tickets).reduce<ETicketState>((s, e) => (RANK[e.state] < RANK[s] ? e.state : s), "cancelled");
      const order: Order = { key, tickets, departAt, state, total: live.reduce((sum, e) => sum + e.price, 0) };
      const lastDay = tickets[0].journeys.at(-1)?.departAt?.slice(0, 10) ?? departAt?.slice(0, 10) ?? today;
      if (live.length && lastDay >= today) upcoming.push(order);
      else past.push(order);
    }
    upcoming = upcoming.sort((a, b) => (a.departAt ?? "").localeCompare(b.departAt ?? ""));
    past = past.sort((a, b) => (b.departAt ?? "").localeCompare(a.departAt ?? ""));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-navy">
        <div className="container-site max-w-4xl py-6 text-white sm:py-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tt.listTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-blue-100/90">{user ? tt.listIntro : tt.signInHint}</p>
        </div>
      </section>
      <main className="flex-1">
        <div className="container-site max-w-4xl py-6 sm:py-8">
          {!user ? (
            <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name="ticket" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-navy">{tt.signInTitle}</h2>
              <p className="mt-2 text-sm text-ink-muted">{tt.signInHint}</p>
              <Link href="/login?next=%2Ftickets" className="btn-primary mt-5 px-6 py-2.5 text-sm">
                {t.common.signIn}
              </Link>
            </div>
          ) : !upcoming.length && !past.length ? (
            <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name="ticket" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-navy">{tt.empty}</h2>
              <Link href="/#search" className="btn-primary mt-5 px-6 py-2.5 text-sm">
                <Icon name="search" className="h-4 w-4" />
                {tt.emptyCta}
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {upcoming.length ? <OrderList title={tt.upcoming} orders={upcoming} t={t} lang={lang} /> : null}
              {past.length ? <OrderList title={tt.past} orders={past} t={t} lang={lang} muted /> : null}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function OrderList({ title, orders, t, lang, muted }: { title: string; orders: Order[]; t: Dict; lang: Lang; muted?: boolean }) {
  const tt = t.ticket;
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <ul className="mt-3 space-y-3">
        {orders.map((o) => {
          const head = o.tickets[0];
          const j = head.journeys[0];
          const back = head.journeys.find((x) => x.kind === "return");
          return (
            <li key={o.key}>
              <Link
                href={`/tickets/${encodeURIComponent(head.reference)}`}
                className={`group flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 transition hover:ring-brand-300 sm:flex-row sm:items-center sm:p-5 ${
                  muted ? "opacity-80" : ""
                }`}
              >
                <div className="flex w-full items-start gap-4 sm:w-auto sm:flex-1">
                  <div className="w-16 shrink-0 rounded-xl bg-brand-50 py-2 text-center text-brand-700">
                    {j?.departAt ? (
                      <>
                        <span className="block text-xl font-bold leading-none">{Number(j.departAt.slice(8, 10))}</span>
                        <span className="mt-1 block text-[11px] font-semibold uppercase">
                          {new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : lang === "es" ? "es-ES" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${j.departAt.slice(0, 10)}T12:00:00Z`))}
                        </span>
                      </>
                    ) : (
                      <Icon name="ticket" className="mx-auto h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">
                      {j ? `${cityLabel(j.from, lang)} → ${cityLabel(j.to, lang)}` : head.reference}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {j?.departAt ? `${longDate(j.departAt, lang, { weekday: "short" })}, ${j.departAt.slice(11, 16)}` : ""}
                      {back?.departAt ? ` · ${tt.return}: ${longDate(back.departAt, lang, { year: false, weekday: "short" })}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {plural(lang, o.tickets.length, tt.passengersN)} · <span className="font-mono">{o.tickets.map((e) => e.reference).join(", ")}</span>
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <StatePill state={o.state} t={t} />
                  <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <span className="tabular-nums">{money(o.total, lang)}</span>
                    <span className="inline-flex items-center gap-1 text-brand-700">
                      {tt.open}
                      <Icon name="chevronRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
