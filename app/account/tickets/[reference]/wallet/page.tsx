import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import WalletPass from "@/components/ticket/WalletPass";
import { applePassConfigured } from "@/lib/tickets/applePass";
import { buildETicket } from "@/lib/tickets/eTicket";
import { qrCodeDataUrl } from "@/lib/tickets/qrcode";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";
import { TICKET_PDF_INCLUDE } from "@/lib/tickets/pdf";

export const dynamic = "force-dynamic";

/** Compact ticket for Apple Wallet. Editing stays on the cabinet ticket page. */
export default async function WalletTicketPage(props: { params: Promise<{ reference: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { reference: params.reference },
    include: TICKET_PDF_INCLUDE,
  });
  if (!booking) notFound();
  if (booking.ticket.userId !== user.id && !hasRoleAtLeast(user.role, "AGENT")) notFound();

  const h = await headers();
  const qr = await qrCodeDataUrl(
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}/check/${booking.reference}`
  );
  const ready = applePassConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center bg-slate-100 px-4 py-8">
      <WalletPass ticket={buildETicket(booking)} qrCode={qr} />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {ready ? (
          <a
            href={`/api/tickets/${booking.reference}/apple-pass`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Додати в Apple Wallet
          </a>
        ) : (
          <p className="max-w-sm text-center text-sm text-slate-600">
            Картка готова. Файл для телефону з’явиться, коли в середовищі будуть сертифікати Apple Wallet.
          </p>
        )}
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
