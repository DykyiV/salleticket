/**
 * Outgoing e-mail to passengers and counterparties.
 *
 * NOTE: delivery is a stub until an SMTP / transactional-mail provider is
 * configured (MAIL_PROVIDER). The message is logged and reported as not
 * delivered, so callers record "prepared" rather than pretend it arrived.
 */
export type Mail = { to: string; subject: string; text: string };
export type MailResult = { delivered: boolean; provider: string };

export async function sendMail(mail: Mail): Promise<MailResult> {
  const provider = process.env.MAIL_PROVIDER ?? process.env.FINANCE_MAIL_PROVIDER ?? "stub";
  if (provider === "stub") {
    console.info(`[mail:stub] to=${mail.to} subject="${mail.subject}"`);
    return { delivered: false, provider };
  }
  console.warn(`[mail] provider "${provider}" is not implemented — message not sent`);
  return { delivered: false, provider };
}
