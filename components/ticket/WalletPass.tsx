import type { ETicketModel } from "@/lib/tickets/eTicket";

/** Compact Apple Wallet-style card. The QR is the same boarding link as on the printed ticket. */
export default function WalletPass({ ticket, qrCode }: { ticket: ETicketModel; qrCode: string }) {
  const seat = (ticket.segments[0]?.seat ?? "—").replace(/^місце\s+/i, "");
  const bus = ticket.segments[0]?.bus;
  return (
    <article className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] bg-brand-700 text-white shadow-xl">
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-sm font-semibold tracking-wide">Asol BUS</p>
          <p className="text-[11px] text-white/70">Електронний квиток</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-brand-200">Місце</p>
          <p className="text-lg font-bold leading-tight">{seat}</p>
        </div>
      </header>
      <div className="mt-5 flex items-end justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-brand-200">Звідки</p>
          <p className="truncate text-2xl font-bold leading-tight">{ticket.routeFrom}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-brand-200">Куди</p>
          <p className="truncate text-2xl font-bold leading-tight">{ticket.routeTo}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 px-5 pb-4 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-brand-200">Виїзд</dt>
          <dd className="font-medium">{ticket.depart}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-brand-200">Прибуття</dt>
          <dd className="font-medium">{ticket.arrive}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] uppercase tracking-wide text-brand-200">Пасажир</dt>
          <dd className="font-medium">{ticket.passenger}</dd>
        </div>
        {bus ? (
          <div className="col-span-2">
            <dt className="text-[10px] uppercase tracking-wide text-brand-200">Автобус</dt>
            <dd className="font-medium">{bus}</dd>
          </div>
        ) : null}
      </dl>
      <div className="bg-white px-5 py-4 text-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCode} alt={`QR ${ticket.reference}`} className="mx-auto h-44 w-44" />
        <p className="mt-1 text-center font-mono text-sm font-semibold tracking-widest">{ticket.reference}</p>
        <p className="mt-1 text-center text-lg font-bold">{ticket.price}</p>
        <p className="mt-1 text-center text-[11px] text-slate-500">QR для перевірки водієм</p>
      </div>
    </article>
  );
}
