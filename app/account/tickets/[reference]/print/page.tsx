import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import PrintTicketButton from "@/components/ticket/PrintTicketButton";
import { ETicketBack, ETicketFront } from "@/components/ticket/ETicket";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { buildETicket } from "@/lib/tickets/eTicket";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";

export const dynamic = "force-dynamic";

/** Two A4 pages: the electronic ticket, then the rules on the back. */
export default async function PrintTicketPage(props: { params: Promise<{ reference: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: {
      ticket: {
        include: {
          legs: {
            orderBy: { order: "asc" },
            include: { assignment: { include: { bus: true, leg: true } } },
          },
          trip: {
            include: {
              carrier: true,
              departure: { include: { stops: true, bus: true } },
            },
          },
        },
      },
    },
  });
  if (!booking) notFound();
  if (booking.ticket.userId !== user.id && !hasRoleAtLeast(user.role, "AGENT")) notFound();

  const h = await headers();
  const qr = await qrCodeDataUrl(
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}/check/${booking.reference}`
  );

  return (
    <main className="mx-auto min-h-screen max-w-[210mm] bg-slate-100 p-4 text-slate-900 print:max-w-none print:bg-white print:p-0">
      <style>{"@page { size: A4; margin: 8mm } @media print { html, body { background: #fff } .ticket-back { break-before: page; } }"}</style>
      <ETicketFront ticket={buildETicket(booking)} qrCode={qr} />
      <div className="ticket-back mt-4 print:mt-0">
        <ETicketBack />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <PrintTicketButton />
        <Link
          href={`/cabinet/tickets/${booking.reference}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Назад до квитка
        </Link>
      </div>
    </main>
  );
}
