"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/site/Icon";
import { fmt, useI18n } from "@/lib/i18n/client";

type Hold = { tripId: string; seatNumber: number; fromStopIndex: number | null; toStopIndex: number | null; expiresAt: string };

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Countdown for this visitor's seat holds with an «extend» button. Reads the
 * holds from the server, so it works on the seat page and the checkout.
 * `version` — bump it after holding / releasing a seat to refresh.
 */
export default function HoldTimer({ version = 0, className = "" }: { version?: number; className?: string }) {
  const { t } = useI18n();
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/holds", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { holds: Hold[] }) : { holds: [] };
    // Expired holds disappear on the server; keep showing them as expired so
    // the passenger can extend (re-hold the same seats if still free).
    setHolds((prev) =>
      data.holds.length || !prev?.some((h) => Date.parse(h.expiresAt) <= Date.now()) ? data.holds : prev
    );
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive) void load();
    };
    const first = window.setTimeout(run, 0);
    const poll = window.setInterval(run, 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load, version]);

  const extend = async () => {
    if (!holds?.length) return;
    setExtending(true);
    await Promise.all(
      holds.map((h) =>
        fetch(`/api/trips/${h.tripId}/holds`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatNumber: h.seatNumber, fromStopIndex: h.fromStopIndex, toStopIndex: h.toStopIndex }),
        }).catch(() => null)
      )
    );
    await load();
    setExtending(false);
  };

  if (!holds || holds.length === 0) return null;
  const left = Math.min(...holds.map((h) => Date.parse(h.expiresAt))) - now;
  const expired = left <= 0;
  const low = left < 2 * 60_000;

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1 ${
        expired || low ? "bg-warn-50 text-warn-700 ring-warn-100" : "bg-brand-50 text-brand-800 ring-brand-100"
      } ${className}`}
    >
      <Icon name="clock" className="h-5 w-5 shrink-0" />
      <span className="flex-1">
        {expired ? t.seat.heldExpired : fmt(t.seat.heldFor, { time: mmss(left) })}
      </span>
      {expired || low ? (
        <button
          type="button"
          onClick={() => void extend()}
          disabled={extending}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-navy ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          {t.seat.extend}
        </button>
      ) : null}
    </div>
  );
}
