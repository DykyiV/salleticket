import type { ReactNode } from "react";
import type { BoardingPassModel } from "@/lib/tickets/boardingPass";

export default function BoardingPassCard({
  pass,
  seatAction,
  returnSeatAction,
}: {
  pass: BoardingPassModel;
  seatAction?: ReactNode;
  returnSeatAction?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Посадковий талон</p>
        <p className="font-mono text-sm font-bold tracking-widest">{pass.reference}</p>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">{pass.passengerName}</p>
          <p className="text-sm text-slate-600">{pass.phones.join(" · ") || "—"}</p>
        </div>
        <p className="text-base font-semibold text-slate-900">
          {pass.fromCity} → {pass.toCity}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Виїзд</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900">{pass.departureLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Прибуття</dt>
            <dd className="text-sm font-semibold tabular-nums text-slate-900">{pass.arrivalLabel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Місце посадки</dt>
            <dd className="text-sm text-slate-900">{pass.boardingPlace}</dd>
            {pass.coordinates ? (
              <dd className="text-xs tabular-nums text-slate-500">{pass.coordinates}</dd>
            ) : null}
            {pass.mapsUrl ? (
              <a
                href={pass.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand-700 underline"
              >
                Відкрити геолокацію на карті
              </a>
            ) : null}
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Номер автобуса</dt>
            <dd className="text-sm font-semibold text-slate-900">{pass.busNumber}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Місце</dt>
            <dd className="text-sm font-semibold text-slate-900">{seatAction ?? pass.seatLabel}</dd>
          </div>
          {returnSeatAction ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Місце назад</dt>
              <dd className="text-sm font-semibold text-slate-900">{returnSeatAction}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Телефон автобуса</dt>
            <dd className="text-sm text-slate-900">{pass.busPhone}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Телефон диспетчера</dt>
            <dd className="text-sm text-slate-900">{pass.dispatcherPhone}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
