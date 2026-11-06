import Link from "next/link";
import PrintTicketButton from "@/components/ticket/PrintTicketButton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { transferSummary } from "@/lib/departures/board";
import { countryNameByCode, flagEmoji } from "@/lib/routes/countries";

export const dynamic = "force-dynamic";

const ddmmyyyy = (iso: string) => iso.split("-").reverse().join(".");
/** "2026-11-10 07:30" → "10.11 07:30" */
const when = (at: string) => (at ? `${at.slice(8, 10)}.${at.slice(5, 7)} ${at.slice(11)}` : "—");
const pair = (board: number, alight: number) =>
  board || alight ? (
    <>
      {board ? <span className="text-emerald-700">+{board}</span> : null}
      {board && alight ? " " : null}
      {alight ? <span className="text-rose-700">−{alight}</span> : null}
    </>
  ) : (
    <span className="text-slate-300">·</span>
  );

/** Passengers by city for organising transfers: departures of one day and one country. */
export default async function TransfersPage(props: { searchParams: Promise<{ date?: string; ids?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "AGENT")) return null;
  const { date = "", ids = "" } = await props.searchParams;
  const summary = await transferSummary({ sub: user.id, role: user.role }, date, ids.split(",").filter(Boolean));

  const back = (
    <Link href="/cabinet/departures" className="text-sm text-brand-700 hover:underline print:hidden">
      ← Усі виїзди
    </Link>
  );
  if (!summary.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        {back}
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">{summary.error}</p>
      </div>
    );
  }

  const ours = summary.cities.reduce((n, c) => n + c.ours.filter((o) => o.kind === "board").length, 0);
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        {back}
        <PrintTicketButton />
      </div>
      <header className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">
          Пасажири по містах · {ddmmyyyy(summary.date)} ·{" "}
          {summary.countryCode ? `${flagEmoji(summary.countryCode)} ${countryNameByCode(summary.countryCode)}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Скільки людей сідає (<span className="text-emerald-700">+</span>) і виходить (
          <span className="text-rose-700">−</span>) у кожному місті з кожного автобуса — за даними перевізника, без імен.
          Імена — лише наших пасажирів ({ours}).
        </p>
      </header>

      <section className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Місто</th>
              <th className="px-3 py-2 font-medium">Час</th>
              {summary.buses.map((b, i) => (
                <th key={b.id} className="px-3 py-2 font-medium">
                  <span className="block text-slate-800">
                    {i + 1}. {b.route}
                  </span>
                  <span className="block font-normal">
                    {b.time} · {b.bus} · зайнято {b.busy}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Разом</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.cities.map((c) => (
              <tr key={c.city} className="align-top">
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-900">{c.city}</span>
                  {c.ours.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {c.ours.map((o) => (
                        <li key={`${o.reference}-${o.kind}`}>
                          <span className={o.kind === "board" ? "text-emerald-700" : "text-rose-700"}>
                            {o.kind === "board" ? "сідає" : "виходить"}
                          </span>{" "}
                          {o.name} · автобус {o.bus + 1}
                          {o.seat ? `, місце ${o.seat}` : ""} ·{" "}
                          <Link href={`/cabinet/tickets/${o.reference}`} className="font-mono text-brand-700 hover:underline">
                            {o.reference}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{when(c.at)}</td>
                {c.perBus.map((n, i) => (
                  <td key={summary.buses[i].id} className="px-3 py-2 font-semibold">
                    {pair(n.board, n.alight)}
                  </td>
                ))}
                <td className="px-3 py-2 font-semibold">{pair(c.board, c.alight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
