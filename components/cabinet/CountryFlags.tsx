import { flagEmoji } from "@/lib/routes/countries";

export default function CountryFlags({
  originCode,
  destinationCode,
  originShort,
  destinationShort,
  originName,
  destinationName,
  size = "md",
}: {
  originCode: string;
  destinationCode: string;
  originShort: string;
  destinationShort: string;
  originName: string;
  destinationName: string;
  size?: "sm" | "md";
}) {
  const flagClass = size === "sm" ? "text-base leading-none" : "text-lg leading-none";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${originName} → ${destinationName}`}
    >
      <span className={flagClass} aria-hidden>
        {flagEmoji(originCode)}
      </span>
      <span className="text-slate-400" aria-hidden>
        –
      </span>
      <span className={flagClass} aria-hidden>
        {flagEmoji(destinationCode)}
      </span>
      <span className="text-xs font-medium text-slate-600">
        {originShort} — {destinationShort}
      </span>
    </span>
  );
}
