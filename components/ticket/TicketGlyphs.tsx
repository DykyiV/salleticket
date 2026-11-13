/**
 * Pictures on the ticket: a coach seat with its number, and the bus picture
 * with its plate. The PDF draws the same (lib/tickets/pdf.ts).
 */

import { SEAT_PATH } from "@/lib/tickets/glyphs";

export function SeatGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 22" className={className} fill="currentColor" aria-hidden="true">
      <path d={SEAT_PATH} />
    </svg>
  );
}

/** The bus picture (public/bus.png) with its plate next to it. The PDF draws the same (lib/tickets/pdf.ts). */
export function BusGlyph({ plate, className }: { plate: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} role="img" aria-label={plate}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bus.png" alt="" className="h-full w-auto shrink-0" />
      <span
        aria-hidden="true"
        className="whitespace-nowrap rounded-md border border-navy bg-white px-1.5 py-0.5 font-mono text-sm font-bold tracking-wider text-navy"
      >
        {plate}
      </span>
    </span>
  );
}
