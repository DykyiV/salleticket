import Link from "next/link";
import SeatPlan from "@/components/departures/SeatPlan";
import { SeatLegend } from "@/components/departures/seatColors";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { findDeparture } from "@/lib/departures/board";
import { flagEmoji } from "@/lib/routes/countries";
import { eur, TICKET_STATUS_CLASS, TICKET_STATUS_LABEL } from "@/lib/tickets/labels";

export const dynamic = "force-dynamic";

const ddmm = (iso: string) => iso.split("-").reverse().join(".");
const at = (d: Date) => `${d.toISOString().slice(8, 10)}.${d.toISOString().slice(5, 7)} ${d.toISOString().slice(11, 16)}`;

export default async function DeparturePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "AGENT")) return null;
  const [{ id }, { date }] = await Promise.all([props.params, props.searchParams]);
  const d = await findDeparture({ sub: user.id, role: user.role }, id, date);

  const back = (
    <Link href="/cabinet/departures" className="text-sm text-brand-700 hover:underline">
      ← Усі виїзди
    </Link>
  );
  if (!d) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        {back}
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">
          Виїзд не знайдено. Перевізник показує лише рейси, що ще не вирушили.
        </p>
      </div>
    );
  }

  const ours = new Map(d.passengers.map((p) => [String(p.seat ?? ""), p.name]));
  const busy = d.seats ? d.seats.counts.reserved + d.seats.counts.purchased : 0;
  const ourSeats = new Set(d.passengers.map((p) => p.seat).filter((s) => s != null)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {back}
      <header className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">
          <span className="mr-2" aria-hidden="true">
            {d.countryCode ? flagEmoji(d.countryCode) : "🚌"}
          </span>
          {d.route}
          <span className="ml-2 align-middle rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-500">
            {d.carrier}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {d.from} {ddmm(d.date)} {d.time} → {d.to} {ddmm(d.arrivalDate)} {d.arrivalTime}
          {d.direction ? ` · ${d.direction === "to" ? "туди" : "назад"}` : ""} · маршрут {d.routeName}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">Пасажири ({d.passengers.length})</h2>
              {d.seats ? (
                <p className="text-xs text-slate-500">
                  Зайнято {busy} з {d.seats.counts.total} місць, наших {ourSeats}. Пасажирів інших продавців перевізник не передає.
                </p>
              ) : null}
            </header>
            {d.passengers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">На цьому виїзді немає наших пасажирів, яких вам видно.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {d.passengers.map((p) => (
                  <li key={`${p.ticketId}-${p.leg}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-200" title="Місце">
                      {p.seat ?? "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {p.name}
                        {p.leg === "return" ? <span className="ml-2 text-xs font-normal text-slate-500">(зворотна поїздка)</span> : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        <a href={`tel:${p.phone}`} className="hover:underline">
                          {p.phone}
                        </a>{" "}
                        · {p.from} → {p.to} · посадка {at(p.departure)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link href={`/cabinet/tickets/${p.reference}`} className="font-mono text-xs text-brand-700 hover:underline">
                        {p.reference}
                      </Link>
                      <p className="mt-1">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${TICKET_STATUS_CLASS[p.status]}`}>
                          {TICKET_STATUS_LABEL[p.status]}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{eur(p.price)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl bg-white ring-1 ring-slate-200">
            <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">Зупинки ({d.stops.length})</h2>
            <ol className="divide-y divide-slate-100 text-sm">
              {d.stops.map((s, i) => (
                <li key={`${s.city}-${i}`} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2">
                  <span className="text-slate-500">
                    {ddmm(s.date).slice(0, 5)} {s.time}
                  </span>
                  <span>
                    <span className="font-medium text-slate-900">{s.city}</span>
                    {s.place ? <span className="text-slate-500"> · {s.place}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {d.busInfo?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.busInfo.photo} alt={`Автобус ${d.busInfo.mark} ${d.busInfo.number}`} className="aspect-[16/10] w-full bg-slate-100 object-cover" />
            ) : null}
            <div className="space-y-2 p-4 text-sm">
              <h2 className="text-base font-semibold text-slate-900">
                {d.busInfo?.mark || d.bus.mark || "Автобус"} <span className="font-mono">[{d.busInfo?.number || d.bus.number || "—"}]</span>
              </h2>
              {d.busInfo ? (
                <p className="text-slate-600">
                  {d.busInfo.seats} місць · {d.busInfo.floors > 1 ? `${d.busInfo.floors} поверхи` : "1 поверх"}
                </p>
              ) : null}
              {d.busInfo?.amenities.length ? (
                <ul className="flex flex-wrap gap-1">
                  {d.busInfo.amenities.map((a) => (
                    <li key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {a}
                    </li>
                  ))}
                </ul>
              ) : null}
              {d.phones ? <p className="text-xs text-slate-500">Телефони: {d.phones}</p> : null}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">Схема салону</h2>
            <SeatLegend ours />
            {d.seats?.places.length ? (
              <SeatPlan places={d.seats.places} ours={ours} />
            ) : (
              <p className="text-sm text-slate-500">Перевізник зараз не віддає схему цього автобуса.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
