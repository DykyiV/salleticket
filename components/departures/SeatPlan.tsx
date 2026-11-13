import { SEAT_COLORS } from "@/components/departures/seatColors";
import type { SeatPlace } from "@/lib/departures/board";

/**
 * Read-only coach plan of a departure: the carrier's seat statuses, our
 * passengers outlined (name on hover). GT layout: x = row from the driver,
 * y = place across the row (1–2 left, 3 aisle, 4–5 right), floor = deck.
 */
export default function SeatPlan({ places, ours }: { places: SeatPlace[]; ours: Map<string, string> }) {
  const floors = [...new Set(places.map((p) => p.floor))].sort((a, b) => a - b);
  return (
    <div className={`grid gap-3 ${floors.length > 1 ? "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : ""}`}>
      {floors.map((floor) => {
        const onFloor = places.filter((p) => p.floor === floor && p.kind !== "other");
        if (!onFloor.length) return null;
        const xs = onFloor.map((p) => p.x);
        const at = new Map(onFloor.map((p) => [`${p.x}:${p.y}`, p]));
        const rows: number[] = [];
        for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) rows.push(x);
        return (
          <section key={floor} className="rounded-3xl border-2 border-slate-200 bg-white p-3">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {floors.length > 1 ? `${floor}-й поверх · ` : ""}перед автобуса ↑
            </p>
            <div className="space-y-1">
              {rows.map((x) => (
                <div key={x} className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((y) => {
                    const p = at.get(`${x}:${y}`);
                    if (!p) return <span key={y} aria-hidden="true" />;
                    if (p.kind !== "seat") {
                      return (
                        <span key={y} className="flex h-8 items-center justify-center rounded bg-slate-100 text-[9px] font-semibold uppercase text-slate-400">
                          {p.kind === "wc" ? "WC" : "водій"}
                        </span>
                      );
                    }
                    const who = ours.get(p.label);
                    return (
                      <span
                        key={y}
                        title={`Місце ${p.label}: ${SEAT_COLORS[p.status].label}${who ? ` · ${who}` : ""}`}
                        className={`flex h-8 items-center justify-center rounded text-xs font-semibold ${SEAT_COLORS[p.status].bar} ${
                          who ? "ring-2 ring-emerald-600 ring-offset-1" : ""
                        }`}
                      >
                        {p.label}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
