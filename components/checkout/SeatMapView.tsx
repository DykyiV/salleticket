"use client";

import Icon from "@/components/site/Icon";
import { fmt, useI18n } from "@/lib/i18n/client";
import { money } from "@/lib/i18n/format";
import type { BusLayout, LayoutCell, Seat } from "@/lib/seats";

export function seatPrice(base: number, seat: Pick<Seat, "mult">): number {
  return Math.round(base * (seat.mult || 1) * 100) / 100;
}

function isSurcharge(seat: Seat): boolean {
  return seat.mult > 1;
}

/**
 * Interactive coach plan: free / taken / yours / unavailable / extra-charge
 * seats, each with its price; chosen seats show the passenger number.
 */
export default function SeatMapView({
  layout,
  selected,
  basePrice,
  onToggle,
  busy,
}: {
  layout: BusLayout;
  /** Chosen seats in passenger order. */
  selected: number[];
  basePrice: number;
  onToggle: (seatNumber: number) => void;
  busy?: boolean;
}) {
  const { t, lang } = useI18n();
  const s = t.seat;

  const describe = (seat: Seat) => {
    const pos =
      seat.kind === "sleeper"
        ? s.sleeper
        : seat.kind === "semi_sleeper"
          ? s.semiSleeper
          : seat.col === 0 || seat.col === 3
            ? s.window
            : s.aisle;
    return `${fmt(s.seatName, { n: seat.number })}, ${pos}, ${money(seatPrice(basePrice, seat), lang)}`;
  };

  return (
    <div>
      <Legend />
      <div className={`mt-4 grid gap-4 ${layout.decks.length > 1 ? "md:grid-cols-2" : ""}`}>
        {layout.decks.map((deck, d) => (
          <section key={deck.name + d} aria-label={deck.name} className="mx-auto w-full max-w-sm rounded-[2rem] border-2 border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-medium text-ink-soft">
              <span>{layout.decks.length > 1 ? deck.name : ""}</span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="bus" className="h-4 w-4" />
                {s.front}
              </span>
            </div>
            <div className={`space-y-1.5 ${busy ? "pointer-events-none opacity-70" : ""}`}>
              {deck.rows.map((row, r) => (
                <div
                  key={r}
                  className="grid gap-1.5"
                  // 2 + 2 rows get a visible aisle in the middle.
                  style={{
                    gridTemplateColumns:
                      row.length === 4 ? "minmax(0,1fr) minmax(0,1fr) 0.75rem minmax(0,1fr) minmax(0,1fr)" : `repeat(${row.length}, minmax(0, 1fr))`,
                  }}
                >
                  {row.flatMap((cell, c) => [
                    ...(row.length === 4 && c === 2 ? [<span key="aisle" aria-hidden="true" />] : []),
                    <Cell
                      key={c}
                      cell={cell}
                      passenger={cell.type === "seat" ? selected.indexOf(cell.seat.number) : -1}
                      basePrice={basePrice}
                      describe={describe}
                      onToggle={onToggle}
                    />,
                  ])}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const { t } = useI18n();
  const l = t.seat.legend;
  const items: { label: string; box: string; icon?: "check" | "close" | "plus" }[] = [
    { label: l.free, box: "border-2 border-ok bg-ok-50" },
    { label: l.selected, box: "border-2 border-brand-600 bg-brand-600 text-white", icon: "check" },
    { label: l.surcharge, box: "border-2 border-warn bg-warn-50 text-warn-700", icon: "plus" },
    { label: l.taken, box: "border-2 border-slate-200 bg-slate-200 text-slate-500", icon: "close" },
    { label: l.unavailable, box: "border-2 border-dashed border-slate-300 bg-white text-slate-400" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${i.box}`} aria-hidden="true">
            {i.icon ? <Icon name={i.icon} className="h-3.5 w-3.5" /> : null}
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Cell({
  cell,
  passenger,
  basePrice,
  describe,
  onToggle,
}: {
  cell: LayoutCell;
  passenger: number;
  basePrice: number;
  describe: (seat: Seat) => string;
  onToggle: (n: number) => void;
}) {
  const { t, lang } = useI18n();
  if (cell.type !== "seat") {
    const label = cell.type === "wc" ? t.seat.wc : cell.type === "door" ? t.seat.door : cell.type === "stairs" ? t.seat.stairs : "";
    return label ? (
      <span className="flex min-h-[3.25rem] items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </span>
    ) : (
      <span aria-hidden="true" />
    );
  }

  const seat = cell.seat;
  const mine = passenger >= 0;
  const taken = seat.status === "OCCUPIED";
  const unavailable = seat.status === "HELD";
  const surcharge = isSurcharge(seat);
  const price = seatPrice(basePrice, seat);
  const label = `${describe(seat)}${taken ? ` — ${t.seat.legend.taken}` : unavailable ? ` — ${t.seat.legend.unavailable}` : ""}`;

  const cls = mine
    ? "border-brand-600 bg-brand-600 text-white shadow-md"
    : taken
      ? "cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400"
      : unavailable
        ? "cursor-not-allowed border-dashed border-slate-300 bg-white text-slate-300"
        : surcharge
          ? "border-warn bg-warn-50 text-warn-700 hover:bg-warn-100"
          : "border-ok bg-ok-50 text-ok-700 hover:bg-ok-100";

  return (
    <button
      type="button"
      disabled={taken || unavailable}
      aria-pressed={mine}
      aria-label={label}
      title={label}
      onClick={() => onToggle(seat.number)}
      className={`relative flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border-2 px-0.5 leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${cls}`}
    >
      {mine ? (
        <span className="absolute -right-1 -top-1.5 rounded-full bg-navy px-1 text-[9px] font-bold text-white">
          {fmt(t.seat.passengerShort, { n: passenger + 1 })}
        </span>
      ) : null}
      <span className="text-sm font-bold tabular-nums">{taken ? <Icon name="close" className="h-4 w-4" /> : seat.number}</span>
      {!taken && !unavailable ? (
        <span className={`text-[10px] font-medium tabular-nums ${mine ? "text-blue-100" : ""}`}>
          {money(price, lang)}
        </span>
      ) : null}
    </button>
  );
}
