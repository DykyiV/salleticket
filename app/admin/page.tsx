import Link from "next/link";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const SECTIONS: {
  title: string;
  cards: { href: string; title: string; description: string; soon?: boolean }[];
}[] = [
  {
    title: "Продажі",
    cards: [
      {
        href: "/admin/tickets",
        title: "Квитки",
        description:
          "Усі квитки з пошуком і фільтрами, деталі, статуси оплати, історія, коментарі, SMS, PDF.",
      },
      {
        href: "/admin/departures",
        title: "Виїзди",
        description:
          "Усі виїзди з фільтрами за країною/перевізником, календарем і сортуванням; пасажири рейсу.",
      },
    ],
  },
  {
    title: "Звіти і статистика",
    cards: [
      {
        href: "/admin/reports",
        title: "Звіти",
        description:
          "Розрахунки з перевізниками (рахунки, акти), звіти агента, перевізника і каси.",
      },
      {
        href: "/admin/stats",
        title: "Статистика",
        description:
          "Продажі по перевізниках, агентах, країнах і містах.",
        soon: true,
      },
    ],
  },
  {
    title: "Комунікації",
    cards: [
      {
        href: "/admin/chat",
        title: "Чат",
        description:
          "Чат-бот, SendPulse, Viber і WhatsApp розсилки.",
        soon: true,
      },
    ],
  },
  {
    title: "Система",
    cards: [
      {
        href: "/admin/settings",
        title: "Налаштування",
        description:
          "Користувачі і права, комісії, промокоди, параметри системи.",
      },
      {
        href: "/admin/directory",
        title: "Довідник",
        description:
          "Міста і країни, перевізники, типи квитків, шаблони повідомлень.",
        soon: true,
      },
      {
        href: "/admin/site",
        title: "Сайт",
        description:
          "HTML-сторінки сайту: про нас, допомога, контакти, SEO.",
        soon: true,
      },
    ],
  },
];

export default async function AdminPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
            ADMIN
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Admin console
          </h1>
          {user ? (
            <p className="mt-1 text-sm text-slate-500">
              {user.email} · {user.role}
            </p>
          ) : null}

          {SECTIONS.map((section) => (
            <div key={section.title} className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.title}
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.cards.map((card) => (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    {card.soon ? (
                      <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        СКОРО
                      </span>
                    ) : null}
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                      {card.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {card.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
