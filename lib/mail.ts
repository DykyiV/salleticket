/**
 * Outgoing e-mail to passengers and counterparties.
 *
 * Providers (MAIL_PROVIDER):
 *   resend — https://api.resend.com/emails, key in MAIL_API_KEY
 *   brevo  — https://api.brevo.com/v3/smtp/email, key in MAIL_API_KEY
 *   empty / "stub" — nothing is sent; callers record "not delivered" instead
 *   of pretending the message arrived.
 * MAIL_FROM is the sender, e.g. `Asol BUS <tickets@grandes-tour.com.ua>`
 * (the domain must be verified with the provider). MAIL_REPLY_TO is optional.
 */
export type MailAttachment = { filename: string; content: Uint8Array };
export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};
export type MailResult = { delivered: boolean; provider: string; id?: string; error?: string };

type Provider = "resend" | "brevo";

function provider(): Provider | null {
  const raw = (process.env.MAIL_PROVIDER ?? process.env.FINANCE_MAIL_PROVIDER ?? "").trim().toLowerCase();
  return raw === "resend" || raw === "brevo" ? raw : null;
}

/** True when a real provider, key and sender are configured. */
export function mailConfigured(): boolean {
  return Boolean(provider() && process.env.MAIL_API_KEY && process.env.MAIL_FROM);
}

/** "Name <a@b.c>" → { name, email }; a bare address → { email }. */
export function parseAddress(value: string): { name?: string; email: string } {
  const m = value.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (m) return m[1] ? { name: m[1].replace(/^"|"$/g, ""), email: m[2] } : { email: m[2] };
  return { email: value.trim() };
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** Request for the provider's HTTP API (exported for tests). */
export function providerRequest(
  name: Provider,
  mail: Mail,
  env: { key: string; from: string; replyTo?: string }
): { url: string; headers: Record<string, string>; body: unknown } {
  const attachments = mail.attachments ?? [];
  if (name === "resend") {
    return {
      url: "https://api.resend.com/emails",
      headers: { Authorization: `Bearer ${env.key}`, "Content-Type": "application/json" },
      body: {
        from: env.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(env.replyTo ? { reply_to: env.replyTo } : {}),
        ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: b64(a.content) })) } : {}),
      },
    };
  }
  const sender = parseAddress(env.from);
  return {
    url: "https://api.brevo.com/v3/smtp/email",
    headers: { "api-key": env.key, "Content-Type": "application/json", Accept: "application/json" },
    body: {
      sender,
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html ?? `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(mail.text)}</pre>`,
      ...(env.replyTo ? { replyTo: parseAddress(env.replyTo) } : {}),
      ...(attachments.length ? { attachment: attachments.map((a) => ({ name: a.filename, content: b64(a.content) })) } : {}),
    },
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const name = provider();
  const key = process.env.MAIL_API_KEY ?? "";
  const from = process.env.MAIL_FROM ?? "";
  if (!name || !key || !from) {
    console.info(`[mail:stub] to=${mail.to} subject="${mail.subject}"`);
    return { delivered: false, provider: name ?? "stub" };
  }
  const req = providerRequest(name, mail, { key, from, replyTo: process.env.MAIL_REPLY_TO || undefined });
  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string; message?: string };
    if (!res.ok) {
      console.warn(`[mail:${name}] ${res.status} ${data.message ?? ""}`.trim());
      return { delivered: false, provider: name, error: `HTTP ${res.status}` };
    }
    return { delivered: true, provider: name, id: data.id ?? data.messageId };
  } catch (err) {
    console.warn(`[mail:${name}] ${(err as Error).message}`);
    return { delivered: false, provider: name, error: (err as Error).message };
  }
}
