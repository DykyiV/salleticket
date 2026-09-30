/** Static stand-in when WebGL is unavailable. */
export default function HeroFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 640 280"
        className="h-full max-h-64 w-full max-w-xl drop-shadow-xl"
        role="img"
        aria-label="Asol BUS coach and boarding pass"
      >
        <rect x="36" y="78" width="430" height="130" rx="28" fill="#f8fafc" />
        <rect x="56" y="98" width="250" height="46" rx="8" fill="#10243f" />
        <rect x="318" y="98" width="120" height="46" rx="8" fill="#10243f" />
        <rect x="56" y="156" width="382" height="10" rx="5" fill="#195ef0" />
        <circle cx="140" cy="214" r="22" fill="#1c1c1c" />
        <circle cx="140" cy="214" r="10" fill="#d7dee7" />
        <circle cx="360" cy="214" r="22" fill="#1c1c1c" />
        <circle cx="360" cy="214" r="10" fill="#d7dee7" />
        <rect x="470" y="46" width="132" height="196" rx="12" fill="#195ef0" />
        <rect x="478" y="54" width="116" height="180" rx="8" fill="#f8fafc" />
        <text x="492" y="88" fill="#195ef0" fontSize="16" fontFamily="sans-serif" fontWeight="700">
          Asol BUS
        </text>
        <text x="492" y="122" fill="#0f172a" fontSize="15" fontFamily="sans-serif" fontWeight="700">
          Kyiv → Berlin
        </text>
        <text x="492" y="156" fill="#64748b" fontSize="12" fontFamily="sans-serif">
          Seat 14
        </text>
        <text x="492" y="196" fill="#0f172a" fontSize="14" fontFamily="sans-serif" fontWeight="700">
          AB-10001
        </text>
      </svg>
    </div>
  );
}
