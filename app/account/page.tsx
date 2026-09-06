import Link from "next/link";
import Header from "@/components/Header";
import LogoutButton from "@/components/LogoutButton";
import ReferralLink from "@/components/ReferralLink";
import CancelTicketButton from "@/components/CancelTicketButton";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getOrCreateReferralCode,
  REFERRAL_REWARD_PERCENT,
  REFERRAL_WELCOME_PERCENT,
} from "@/lib/referrals";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Protected account page. The middleware already ensures an authenticated
 * user reaches this page; we still call getCurrentUser for fresh DB data.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();

  const discountCards = user
    ? await prisma.discountCard.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const referralCode = user ? await getOrCreateReferralCode(prisma, user.id) : null;

  const myTickets = user
    ? await prisma.ticket.findMany({
        where: { userId: user.id },
        include: { booking: true, trip: { include: { carrier: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  // Promotions this user can use: campaigns bound to them personally, plus
  // any public one (userId null) — including ones that haven't started yet,
  // so "буде" (upcoming) promotions show up too, not just currently live
  // ones. Already-ended campaigns are excluded.
  const now = new Date();
  const promotions = user
    ? await prisma.promo.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ userId: user.id }, { userId: null }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
        orderBy: { startsAt: "asc" },
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            This page is protected by the middleware — only signed-in users can view it.
          </p>

          {user ? (
            <div className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Role:{" "}
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                    {user.role}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Member since{" "}
                  {new Date(user.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <Link
                  href="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Book a trip
                </Link>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/admin"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Admin console
                  </Link>
                )}
                {(user.role === "AGENT" ||
                  user.role === "ADMIN" ||
                  user.role === "SUPER_ADMIN") && (
                  <Link
                    href="/agent"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Agent console
                  </Link>
                )}
                <LogoutButton />
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Мої квитки
            </p>
            {myTickets.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                У вас ще немає бронювань.{" "}
                <Link href="/" className="text-brand-700 underline">
                  Знайти рейс
                </Link>
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 py-2 pr-3">Квиток</th>
                      <th className="border-b border-slate-200 py-2 pr-3">Рейс</th>
                      <th className="border-b border-slate-200 py-2 pr-3">Дата</th>
                      <th className="border-b border-slate-200 py-2 pr-3">Статус</th>
                      <th className="border-b border-slate-200 py-2 pr-3">Ціна</th>
                      <th className="border-b border-slate-200 py-2 pr-3">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.map((t) => (
                      <tr key={t.id}>
                        <td className="border-t border-slate-100 py-2 pr-3 font-mono">
                          {t.booking?.reference ?? "—"}
                        </td>
                        <td className="border-t border-slate-100 py-2 pr-3">
                          {t.trip ? `${t.trip.fromCity} → ${t.trip.toCity}` : "—"}
                        </td>
                        <td className="border-t border-slate-100 py-2 pr-3">
                          {t.trip
                            ? t.trip.departureTime.toLocaleDateString("uk-UA")
                            : "—"}
                        </td>
                        <td className="border-t border-slate-100 py-2 pr-3">
                          {t.status}
                        </td>
                        <td className="border-t border-slate-100 py-2 pr-3 tabular-nums">
                          €{t.finalPrice.toFixed(2)}
                        </td>
                        <td className="border-t border-slate-100 py-2 pr-3">
                          {t.status === "RESERVED" ? (
                            <CancelTicketButton ticketId={t.id} status="RESERVED" />
                          ) : t.status === "PAID_CASH" || t.status === "PAID_ONLINE" ? (
                            <span className="text-[11px] text-slate-400">
                              Для повернення зверніться до підтримки
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {discountCards.length > 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ваші дисконтні картки
              </p>
              <div className="mt-3 space-y-2">
                {discountCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                  >
                    <span className="font-mono text-sm font-semibold text-emerald-900">
                      {card.code}
                    </span>
                    <span className="text-sm font-medium text-emerald-700">
                      −{Math.round(card.percent * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Вкажіть код картки при бронюванні — знижка діє безстроково.
              </p>
            </div>
          ) : null}

          {promotions.length > 0 ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Акції
              </p>
              <div className="mt-3 space-y-2">
                {promotions.map((promo) => {
                  const upcoming = promo.startsAt && promo.startsAt > now;
                  return (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {promo.code}
                        </span>
                        {promo.label ? (
                          <span className="ml-2 text-xs text-slate-500">
                            {promo.label}
                          </span>
                        ) : null}
                        {upcoming ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Скоро — з{" "}
                            {promo.startsAt!.toLocaleDateString("uk-UA")}
                          </span>
                        ) : null}
                        {promo.userId ? (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                            Персональна
                          </span>
                        ) : null}
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {promo.type === "FIXED"
                          ? `-€${(promo.amount ?? 0).toFixed(2)}`
                          : `-${Math.round(promo.percent * 100)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Вкажіть промокод при бронюванні, щоб застосувати знижку.
              </p>
            </div>
          ) : null}

          {referralCode ? (
            <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Запросіть друга
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Поділіться посиланням — коли ваш друг оформить перше
                бронювання, ви отримаєте дисконтну картку на{" "}
                {Math.round(REFERRAL_REWARD_PERCENT * 100)}%. Друг одразу
                отримує вітальну картку на{" "}
                {Math.round(REFERRAL_WELCOME_PERCENT * 100)}%.
              </p>
              <ReferralLink code={referralCode} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
