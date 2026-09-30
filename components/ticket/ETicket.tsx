import { TICKET_BACK, TICKET_BRIEF } from "@/lib/legal";
import type { ETicketModel } from "@/lib/tickets/eTicket";

function Logo() {
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-brand-700">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M8 6v6M16 6v6M2 12h19.6" />
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2V6c0-1.1-.9-2-2-2H4a2 2 0 0 0-2 2v8c0 .5.2 1 .6 1.4L4 18" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-wide">Asol BUS</span>
        <span className="block text-[10px] text-white/70">Електронний квиток</span>
      </span>
    </div>
  );
}

export function ETicketFront({
  ticket,
  qrCode,
}: {
  ticket: ETicketModel;
  qrCode: string;
}) {
  return (
    <article className="overflow-hidden rounded-md border-2 border-slate-800 bg-white text-slate-900">
      <header className="flex items-center justify-between gap-3 bg-brand-700 px-4 py-3">
        <Logo />
        <div className="text-right text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Номер бронювання</p>
          <p className="font-mono text-lg font-bold tracking-widest">{ticket.reference}</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <section className="border-b border-slate-300">
            <h2 className="bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              Дані пасажира
            </h2>
            <dl className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">Пасажир</dt>
                <dd className="font-semibold">{ticket.passenger}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">Категорія</dt>
                <dd>{ticket.category}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">Телефони</dt>
                <dd>{ticket.phones}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="break-all">{ticket.email}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">Видано</dt>
                <dd>{ticket.issued}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              Маршрут {ticket.routeFrom} — {ticket.routeTo}
            </h2>
            <p className="px-3 pt-2 text-sm text-slate-600">
              Виїзд {ticket.depart}
              <span className="mx-2 text-slate-300">·</span>
              Прибуття {ticket.arrive}
            </p>
            <ol>
              {ticket.segments.map((segment, index) => (
                <li key={segment.order}>
                  <div className="grid gap-2 px-3 py-3 sm:grid-cols-[28px_1fr_auto_1fr]">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-700 text-sm font-bold text-white">
                      {segment.order}
                    </span>
                    <div>
                      <p className="text-lg font-bold leading-none">{segment.fromCity}</p>
                      <p className="mt-1 text-xs text-slate-500">{segment.fromDetail}</p>
                      <p className="mt-1 text-xs font-medium">{segment.depart}</p>
                    </div>
                    <div className="text-center text-xs text-slate-500 sm:px-2">
                      <p className="font-semibold text-slate-800">{segment.bus}</p>
                      <p className="mt-1 font-semibold text-brand-800">{segment.seat}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-lg font-bold leading-none">{segment.toCity}</p>
                      <p className="mt-1 text-xs text-slate-500">{segment.toDetail}</p>
                      <p className="mt-1 text-xs font-medium">{segment.arrive}</p>
                    </div>
                  </div>
                  {ticket.layovers[index] ? (
                    <div className="mx-3 mb-2 flex items-center gap-2 rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-base" aria-hidden="true">⏱</span>
                      <span>
                        Можлива зміна автобуса
                        {ticket.layovers[index].city ? ` · ${ticket.layovers[index].city}` : ""} ·{" "}
                        {ticket.layovers[index].minutes} хв
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="border-t border-slate-300 bg-slate-50 p-3 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Електронний квиток</p>
          <p className="mt-1 text-sm font-semibold">{ticket.passenger}</p>
          <p className="mt-2 text-xs uppercase text-slate-500">Звідки</p>
          <p className="font-bold">{ticket.routeFrom}</p>
          <p className="mt-2 text-xs uppercase text-slate-500">Куди</p>
          <p className="font-bold">{ticket.routeTo}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt={`QR ${ticket.reference}`} className="mx-auto mt-3 h-40 w-40 bg-white p-1 ring-1 ring-slate-200" />
          <p className="mt-1 text-center font-mono text-xs tracking-widest">{ticket.reference}</p>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-500">Вартість</p>
          <p className="text-2xl font-bold tabular-nums">{ticket.price}</p>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            QR відкриває квиток. Під час перевірки водій фіксує посадку.
          </p>
        </aside>
      </div>

      <footer className="grid gap-3 border-t-2 border-slate-800 px-3 py-3 text-xs sm:grid-cols-2">
        <p>{TICKET_BRIEF.baggage}</p>
        <p>{TICKET_BRIEF.refund}</p>
      </footer>
    </article>
  );
}

export function ETicketBack() {
  return (
    <article className="overflow-hidden rounded-md border-2 border-slate-800 bg-white text-slate-900">
      <header className="bg-brand-700 px-4 py-3 text-white">
        <p className="text-sm font-bold">Asol BUS · зворотна сторона квитка</p>
        <p className="text-[11px] text-white/80">Правила поведінки, багаж, страхування, повернення</p>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {TICKET_BACK.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-800">{section.title}</h2>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700">
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
