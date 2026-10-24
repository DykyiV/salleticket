import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import StepIndicator from "@/components/checkout/StepIndicator";
import ETicketCard from "@/components/ticket/ETicketCard";
import TicketActions from "@/components/ticket/TicketActions";
import { getCurrentUser } from "@/lib/auth/session";
import { getDict } from "@/lib/i18n/server";
import { fmt, longDate, money, plural } from "@/lib/i18n/format";
import { mailConfigured } from "@/lib/mail";
import { reconcileTicketPayment } from "@/lib/payments";
import { getSiteContacts, telHref } from "@/lib/siteContacts";
import { siteOrigin, toETicket, viewableGroup, type ETicket } from "@/lib/tickets/eTicket";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";
import { cityLabel } from "@/lib/trips/cities";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.ticket.metaTitle} — Asol BUS`, robots: { index: false } };
}

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<Record<string, string | undefined>> };

/**
 * Step 5 «Квиток»: the passenger's e-tickets for one order — QR for the
 * driver, boarding addresses, seat, price, PDF and e-mail. Also the page
 * «Мої квитки» links to.
 */
export default async function TicketPage(props: Props) {
  const [{ reference }, sp] = await Promise.all([props.params, props.searchParams]);
  const [{ t, lang }, user] = await Promise.all([getDict(), getCurrentUser()]);
  const tt = t.ticket;
  if (!user) redirect(`/login?next=${encodeURIComponent(`/tickets/${reference}`)}`);
  const who = { sub: user.id, role: user.role };

  // Settle or expire pending online payments before showing the status.
  const before = await viewableGroup(reference, who);
  if (before) await Promise.all(before.map((b) => reconcileTicketPayment(b.ticketId)));
  const group = before ? await viewableGroup(reference, who) : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = siteOrigin(host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null);
  const tickets: ETicket[] = (group ?? []).map((b) => toETicket(b, origin));
  const qrs = await Promise.all(tickets.map((e) => qrCodeDataUrl(e.checkUrl)));
  const contacts = await getSiteContacts().catch(() => null);
  const phone = contacts?.phoneUa || contacts?.phoneEs || contacts?.phoneDe || null;

  const head = tickets.find((e) => e.reference === reference) ?? tickets[0];
  const first = head?.journeys[0];
  const isNew = sp.new === "1" && tickets.length > 0;
  const live = tickets.filter((e) => e.state !== "cancelled" && e.state !== "refunded");
  const due = live.reduce((sum, e) => sum + e.toPay, 0);
  const allPaid = live.length > 0 && live.every((e) => e.state === "paid");
  const pending = live.some((e) => e.state === "pending");
  const email = live.find((e) => e.email)?.email ?? null;
  const mailOn = mailConfigured();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-navy">
        <div className="container-site py-5 sm:py-6">
          <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
            <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            {tt.listTitle}
          </Link>
          <div className="mt-3 text-white">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{tt.metaTitle}</h1>
            {first ? (
              <p className="mt-1 text-sm text-blue-100/90">
                {cityLabel(first.from, lang)} → {cityLabel(first.to, lang)}
                {first.departAt ? ` · ${longDate(first.departAt, lang, { year: false, weekday: "short" })}, ${first.departAt.slice(11, 16)}` : ""}
                {tickets.length > 1 ? ` · ${plural(lang, tickets.length, tt.passengersN)}` : ""}
              </p>
            ) : null}
          </div>
          {isNew ? (
            <div className="mt-5">
              <StepIndicator t={t} current={5} />
            </div>
          ) : null}
        </div>
      </section>

      <main className="flex-1">
        <div className="container-site py-6 sm:py-8">
          {!group || !tickets.length ? (
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
              <h2 className="text-lg font-semibold text-navy">{tt.notFound}</h2>
              <p className="mt-2 text-sm text-ink-muted">{tt.notFoundHint}</p>
              <Link href="/tickets" className="btn-primary mt-5 px-5 py-2.5 text-sm">
                {tt.listTitle}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {isNew ? (
                <div
                  role="status"
                  className={`flex gap-4 rounded-2xl p-5 ring-1 ${pending && !allPaid ? "bg-brand-50 ring-brand-100" : "bg-ok-50 ring-ok-100"}`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ${
                      pending && !allPaid ? "text-brand-700 ring-brand-100" : "text-ok-700 ring-ok-100"
                    }`}
                  >
                    <Icon name={pending && !allPaid ? "clock" : "check"} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 space-y-1 text-sm text-ink">
                    <p className="text-lg font-bold text-navy">
                      {allPaid ? tt.successPaid : pending ? tt.successPending : tt.successCash}
                    </p>
                    {!allPaid ? <p>{pending ? tt.successPendingHint : tt.successCashHint}</p> : null}
                    {due > 0 && !pending ? (
                      <p className="font-semibold text-warn-700">
                        {tt.toPay}: <span className="tabular-nums">{money(due, lang)}</span>
                      </p>
                    ) : null}
                    <p className="text-ink-muted">{mailOn && email && !pending ? fmt(tt.sentTo, { email }) : tt.keepOffline}</p>
                    {user.passwordSet === false ? (
                      <p>
                        {tt.setPassword}{" "}
                        <Link href="/cabinet" className="font-semibold text-brand-700 underline">
                          {tt.setPasswordCta}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <div className="space-y-6">
                  {/* On a phone the PDF / e-mail buttons come first, above the tickets. */}
                  <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70 lg:hidden">
                    <TicketActions reference={head.reference} email={email} mailOn={mailOn} />
                  </div>
                  {tickets.map((e, i) => (
                    <ETicketCard key={e.reference} e={e} qr={qrs[i]} t={t} lang={lang} />
                  ))}
                </div>

                <aside className="space-y-4 lg:sticky lg:top-24">
                  <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
                    <div className="hidden lg:block">
                      <TicketActions reference={head.reference} email={email} mailOn={mailOn} />
                    </div>
                    <div className="grid gap-1 text-sm lg:mt-2 lg:border-t lg:border-slate-100 lg:pt-3">
                      <Link href={`/cabinet/tickets/${encodeURIComponent(head.reference)}`} className="flex items-center justify-between rounded-lg px-2 py-2 font-medium text-navy hover:bg-slate-50">
                        {tt.manage}
                        <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                      </Link>
                      <Link href="/tickets" className="flex items-center justify-between rounded-lg px-2 py-2 font-medium text-navy hover:bg-slate-50">
                        {tt.allTickets}
                        <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                      </Link>
                      <Link href="/#search" className="flex items-center justify-between rounded-lg px-2 py-2 font-medium text-navy hover:bg-slate-50">
                        {tt.newTrip}
                        <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-2xl bg-warn-50 p-4 ring-1 ring-warn-100">
                    <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-warn-700" />
                    <p className="text-sm font-semibold text-ink">{tt.arrive}</p>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
                    <h2 className="font-semibold text-navy">{tt.rulesTitle}</h2>
                    <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                      {tt.rules.map((rule) => (
                        <li key={rule} className="flex gap-2">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 flex flex-wrap gap-x-3 text-sm">
                      <Link href="/baggage" className="font-medium text-brand-700 hover:underline">
                        {t.footer.baggage}
                      </Link>
                      <Link href="/rules" className="font-medium text-brand-700 hover:underline">
                        {t.footer.terms}
                      </Link>
                    </p>
                    {phone ? (
                      <a href={telHref(phone)} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-navy ring-1 ring-slate-200/70">
                        <Icon name="phone" className="h-4 w-4 text-brand-600" />
                        {phone}
                      </a>
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
