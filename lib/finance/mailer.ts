/**
 * Finance e-mail (auto-reports, invoices) — goes through the shared mail
 * adapter (lib/mail.ts), which is a stub until a provider is configured.
 */
import { sendMail, type Mail, type MailResult } from "@/lib/mail";

export type FinanceMail = Mail;
export type { MailResult };

export async function sendFinanceMail(mail: FinanceMail): Promise<MailResult> {
  return sendMail(mail);
}
