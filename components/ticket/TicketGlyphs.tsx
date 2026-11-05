/**
 * Pictures on the ticket: a coach seat with its number, and a schematic bus
 * with the plate on it. The PDF draws the same shapes (lib/tickets/pdf.ts).
 */

import { SEAT_PATH } from "@/lib/tickets/glyphs";

export function SeatGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 22" className={className} fill="currentColor" aria-hidden="true">
      <path d={SEAT_PATH} />
    </svg>
  );
}

/** Coach seen from the side (front to the right) with the plate on its body. */
export function BusGlyph({ plate, className }: { plate: string; className?: string }) {
  const windows = [6, 22, 38, 54, 70, 86];
  return (
    <svg viewBox="0 0 132 48" className={className} role="img" aria-label={plate}>
      <rect x="1" y="1" width="130" height="38" rx="7" className="fill-brand-600" />
      {windows.map((x) => (
        <rect key={x} x={x} y="6" width="13" height="10" rx="2" fill="#fff" fillOpacity="0.85" />
      ))}
      {/* windscreen and door */}
      <path d="M106 6h14a6 6 0 0 1 6 6v8h-20z" fill="#fff" fillOpacity="0.85" />
      <rect x="106" y="22" width="9" height="15" rx="1.5" fill="#fff" fillOpacity="0.35" />
      {/* plate */}
      <rect x="10" y="20" width="88" height="15" rx="2.5" fill="#fff" stroke="#142C2A" strokeWidth="1" />
      <text
        x="54"
        y="31.2"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        fill="#142C2A"
        letterSpacing="0.6"
        // Long text («уточнюється») is squeezed to fit the plate.
        {...(plate.length > 11 ? { textLength: 82, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {plate}
      </text>
      {[24, 104].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="40" r="7" fill="#142C2A" />
          <circle cx={cx} cy="40" r="2.6" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}
