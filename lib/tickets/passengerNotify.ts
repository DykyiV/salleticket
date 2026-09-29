import { prisma } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { sendMail } from "@/lib/mail";
import { recordTicketHistory } from "@/lib/tickets/history";

/**
 * Tell the passenger something by SMS and e-mail, and record both in the
 * ticket history. Both adapters are stubs until real providers are set up;
 * the history says whether the message was actually delivered.
 */
export async function notifyPassenger(
  ticketId: string,
  message: { sms: string; subject: string; text: string }
): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { ticketId },
    select: { phone: true, email: true },
  });
  if (!booking) return;

  if (booking.phone) {
    const sms = await sendSms(booking.phone, message.sms);
    await recordTicketHistory(prisma, {
      ticketId,
      action: sms.ok ? "SMS_SENT" : "SMS_FAILED",
      source: "SYSTEM",
      changes: { sms: { from: null, to: message.sms } },
    });
  }
  if (booking.email) {
    const mail = await sendMail({ to: booking.email, subject: message.subject, text: message.text });
    await recordTicketHistory(prisma, {
      ticketId,
      action: "EMAIL_SENT",
      source: "SYSTEM",
      changes: {
        email: { from: null, to: mail.delivered ? message.subject : `${message.subject} (пошта ще не підключена)` },
      },
    });
  }
}
