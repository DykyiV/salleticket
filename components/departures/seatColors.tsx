/** Seat colours as on the Grandes Tour board (shared by the list and the departure page). */
export const SEAT_COLORS = {
  closed: { bar: "bg-slate-300 text-slate-700", label: "Недоступні (інший рейс автобуса)" },
  reserved: { bar: "bg-amber-400 text-amber-950", label: "Бронь" },
  purchased: { bar: "bg-rose-500 text-white", label: "Оплачено" },
  free: { bar: "bg-sky-400 text-sky-950", label: "Вільні" },
} as const;

export function SeatLegend({ ours = false }: { ours?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {(Object.keys(SEAT_COLORS) as (keyof typeof SEAT_COLORS)[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded-sm ${SEAT_COLORS[k].bar}`} aria-hidden="true" />
          {SEAT_COLORS[k].label}
        </li>
      ))}
      {ours ? (
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm ring-2 ring-emerald-600" aria-hidden="true" />
          Наші пасажири
        </li>
      ) : null}
    </ul>
  );
}
