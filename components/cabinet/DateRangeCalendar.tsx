"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUkDate, toIsoDate, utcDateOnly } from "@/lib/routes/dates";
import { WEEKDAYS } from "@/lib/routes/weekdays";

const MONTHS = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

type Cell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

function monthCells(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay() === 0 ? 7 : first.getUTCDay();
  const leading = startWeekday - 1;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Cell[] = [];
  for (let i = 0; i < leading; i += 1) {
    const date = new Date(Date.UTC(year, month, 1 - (leading - i)));
    cells.push({ iso: toIsoDate(date), day: date.getUTCDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    cells.push({ iso: toIsoDate(date), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = utcDateOnly(cells[cells.length - 1].iso);
    const date = new Date(last.getTime());
    date.setUTCDate(date.getUTCDate() + 1);
    cells.push({
      iso: toIsoDate(date),
      day: date.getUTCDate(),
      inMonth: false,
    });
  }
  return cells;
}

export default function DateRangeCalendar({ from, to, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const startDate = utcDateOnly(from);
  const [viewYear, setViewYear] = useState(startDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(startDate.getUTCMonth());
  const [pickingEnd, setPickingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState(from);
  const [draftEnd, setDraftEnd] = useState<string | null>(to);

  const cells = useMemo(
    () => monthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setPickingEnd(false);
        setDraftStart(from);
        setDraftEnd(to);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPickingEnd(false);
        setDraftStart(from);
        setDraftEnd(to);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, from, to]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  const rangeStart = draftStart;
  const rangeEnd = pickingEnd ? draftEnd : draftEnd ?? to;
  const hiStart =
    rangeStart && rangeEnd && rangeStart > (rangeEnd ?? rangeStart)
      ? rangeEnd
      : rangeStart;
  const hiEnd =
    rangeStart && rangeEnd && rangeStart > rangeEnd ? rangeStart : rangeEnd;

  const onDay = (iso: string) => {
    if (!pickingEnd) {
      setDraftStart(iso);
      setDraftEnd(null);
      setPickingEnd(true);
      return;
    }
    let nextFrom = draftStart;
    let nextTo = iso;
    if (nextTo < nextFrom) {
      [nextFrom, nextTo] = [nextTo, nextFrom];
    }
    setDraftStart(nextFrom);
    setDraftEnd(nextTo);
    setPickingEnd(false);
    setOpen(false);
    onChange(nextFrom, nextTo);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const date = utcDateOnly(from);
      setViewYear(date.getUTCFullYear());
      setViewMonth(date.getUTCMonth());
      setDraftStart(from);
      setDraftEnd(to);
      setPickingEnd(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        Період
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded border bg-white px-2 text-left text-sm text-slate-900 ${
          open ? "border-brand-400 ring-1 ring-brand-200" : "border-slate-300"
        }`}
      >
        <span>
          {formatUkDate(from)} — {formatUkDate(to)}
        </span>
        <span className="text-slate-400" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-[280px] rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
              onClick={() => shiftMonth(-1)}
              aria-label="Попередній місяць"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {MONTHS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
              onClick={() => shiftMonth(1)}
              aria-label="Наступний місяць"
            >
              ›
            </button>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">
            {pickingEnd
              ? "Другий клік — кінець періоду"
              : "Перший клік — початок періоду"}
          </p>
          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((day) => (
              <span key={day.id}>{day.short}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-px">
            {cells.map((cell) => {
              const isStart = cell.iso === hiStart;
              const isEnd = Boolean(hiEnd) && cell.iso === hiEnd;
              const inRange =
                hiStart != null &&
                hiEnd != null &&
                cell.iso >= hiStart &&
                cell.iso <= hiEnd;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => onDay(cell.iso)}
                  className={`h-8 rounded text-xs ${
                    isStart || isEnd
                      ? "bg-brand-600 font-semibold text-white"
                      : inRange
                        ? "bg-brand-50 text-brand-800"
                        : cell.inMonth
                          ? "text-slate-800 hover:bg-slate-50"
                          : "text-slate-300"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
