import PageHeader from "@/components/cabinet/PageHeader";

export const dynamic = "force-dynamic";

const GROUPS: {
  title: string;
  endpoints: { method: string; path: string; note: string }[];
}[] = [
  {
    title: "Пошук і рейси",
    endpoints: [
      { method: "GET", path: "/api/search?from=&to=&date=", note: "Рейси всіх перевізників з цінами тарифної сітки" },
      { method: "GET", path: "/api/trips?from=&to=&date=", note: "Внутрішні рейси на дату (найближчі, якщо порожньо)" },
      { method: "GET", path: "/api/trips/{id}/seats", note: "Схема місць: вільні / зайняті / бронь" },
      { method: "POST", path: "/api/trips/{id}/holds", note: "Тимчасова бронь місця за сесією" },
      { method: "DELETE", path: "/api/trips/{id}/holds", note: "Звільнити бронь місця" },
    ],
  },
  {
    title: "Бронювання і квитки",
    endpoints: [
      { method: "POST", path: "/api/booking", note: "Створити бронювання (1–6 пасажирів, місця, тип квитка, спосіб оплати)" },
      { method: "GET", path: "/api/booking?reference=", note: "Стан бронювання за номером" },
      { method: "PATCH", path: "/api/account/tickets/{id}/passenger", note: "Дані пасажира" },
      { method: "PATCH", path: "/api/account/tickets/{id}/seat", note: "Зміна місця" },
      { method: "PATCH", path: "/api/account/tickets/{id}/trip", note: "Зміна дати/рейсу в тому ж напрямку" },
      { method: "PATCH", path: "/api/account/tickets/{id}/return", note: "Призначити зворотній рейс (відкрита дата)" },
      { method: "PATCH", path: "/api/account/tickets/{id}/status", note: "Статуси: оплати, скасування, повернення" },
      { method: "GET", path: "/api/tickets/{reference}/pdf", note: "PDF-квиток з QR" },
    ],
  },
  {
    title: "Оплати",
    endpoints: [
      { method: "POST", path: "/api/payments/{reference}/pay", note: "Підтвердження оплати (група або один квиток)" },
      { method: "GET", path: "/api/payments/{reference}/status", note: "Стан оплати + звірка зарахування" },
    ],
  },
  {
    title: "Ціни й маршрути",
    endpoints: [
      { method: "GET", path: "/api/admin/tariffs", note: "Тарифні сітки країн (price.read)" },
      { method: "PUT", path: "/api/admin/tariffs", note: "Зберегти сітку країни (price.edit)" },
      { method: "GET", path: "/api/admin/departures", note: "Виїзди з фільтрами" },
      { method: "PATCH", path: "/api/admin/departures/{id}", note: "Місця на виїзді (route.edit)" },
    ],
  },
  {
    title: "Сповіщення і акаунт",
    endpoints: [
      { method: "GET", path: "/api/notifications", note: "Центр сповіщень (роль + персональні)" },
      { method: "POST", path: "/api/notifications", note: "Позначити прочитаними" },
      { method: "PATCH", path: "/api/account/profile", note: "Профіль і канали сповіщень" },
    ],
  },
];

export default function CabinetApiPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="API-first"
        subtitle="Сайт і CRM ходять через той самий API Core — до нього ж пізніше підключаться мобільний застосунок, партнери, агрегатори, каса, call-center і Telegram-бот."
      />

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Архітектура</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">{`                    ASOL BUS
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
       WEBSITE                    CRM
          │                         │
          └──────────┬──────────────┘
                     ▼
                 API CORE  (/api/*)
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   GRANDES       Carrier API   Partner API
    TOUR`}</pre>
        <p className="mt-3 text-xs text-slate-500">
          Авторизація — сесійна кука (як зараз) або API-ключ партнера (наступний
          етап). Усі відповіді JSON, помилки — {`{ error, reason? }`} з
          HTTP-кодами. Ціни й місця завжди рахуються на сервері.
        </p>
      </section>

      <div className="mt-5 space-y-4">
        {GROUPS.map((group) => (
          <section
            key={group.title}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">
              {group.title}
            </h2>
            <ul className="divide-y divide-slate-100">
              {group.endpoints.map((e) => (
                <li key={e.path + e.method} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                      e.method === "GET"
                        ? "bg-emerald-50 text-emerald-700"
                        : e.method === "POST"
                          ? "bg-sky-50 text-sky-700"
                          : e.method === "DELETE"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {e.method}
                  </span>
                  <code className="font-mono text-xs text-slate-900">{e.path}</code>
                  <span className="text-xs text-slate-500">{e.note}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
