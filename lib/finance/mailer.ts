/**
 * Outgoing finance e-mail (auto-reports, invoices).
 *
 * NOTE: delivery is a stub until an SMTP / transactional-mail provider is
 * configured — the message is logged and reported as not delivered, so the
 * caller can record "prepared" rather than pretend it reached the inbox.
 * Integration point: set FINANCE_MAIL_PROVIDER and send here.
 */
export type FinanceMail = {
  to: string;
  subject: string;
  text: string;
};

export type MailResult = { delivered: boolean; provider: string };

export async function sendFinanceMail(mail: FinanceMail): Promise<MailResult> {
  const provider = process.env.FINANCE_MAIL_PROVIDER ?? "stub";
  if (provider === "stub") {
    console.info(`[finance-mail:stub] to=${mail.to} subject="${mail.subject}"`);
    return { delivered: false, provider };
  }
  // A real provider is wired here once credentials exist.
  console.warn(`[finance-mail] provider "${provider}" is not implemented — message not sent`);
  return { delivered: false, provider };
}
