import { mapsUrl, type BoardingStop } from "@/lib/routes/boarding";

type Props = {
  label: string;
  stop: BoardingStop | null;
};

export default function BoardingHint({ label, stop }: Props) {
  if (!stop) return null;
  const url = mapsUrl(stop);
  const text = stop.addressLabel || stop.boardingAddress || stop.city;
  return (
    <div className="text-sm text-slate-700">
      <span className="font-medium">{label}: </span>
      {text}
      {stop.outboundTime ? ` · ${stop.outboundTime}` : ""}
      {url ? (
        <>
          {" "}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-brand-700 underline"
          >
            карта
          </a>
        </>
      ) : null}
    </div>
  );
}
