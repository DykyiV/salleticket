import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { issuePasswordReset } from "@/lib/auth/passwordReset";
import { fmt } from "@/lib/i18n/format";
import { getDict } from "@/lib/i18n/server";
import { mailConfigured, sendMail } from "@/lib/mail";
import {
  RESET_PER_EMAIL,
  RESET_PER_IP,
  blockedFor,
  clientIp,
  limitKey,
  recordHit,
} from "@/lib/security/rateLimit";
import { requestOrigin, siteOrigin } from "@/lib/tickets/eTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * POST { email } — «Забули пароль?»: e-mails a one-time link to set a new
 * password. The answer is the same whether the e-mail has an account or not;
 * 503 only when mail is not connected at all.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Вкажіть коректний e-mail" }, { status: 400 });
  }
  if (!mailConfigured()) return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });

  const ip = clientIp(req);
  const keys = [
    { key: limitKey("reset:email", email), rule: RESET_PER_EMAIL },
    ...(ip ? [{ key: limitKey("reset:ip", ip), rule: RESET_PER_IP }] : []),
  ];
  for (const { key, rule } of keys) {
    const wait = await blockedFor(key, rule);
    if (wait > 0) {
      return NextResponse.json({ error: "too_many" }, { status: 429, headers: { "Retry-After": String(wait) } });
    }
  }
  for (const { key, rule } of keys) await recordHit(key, rule);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const token = await issuePasswordReset(user.id);
    const link = `${siteOrigin(requestOrigin(req))}/reset-password?token=${token}`;
    const { t } = await getDict();
    await sendMail({ to: email, subject: t.auth.resetMailSubject, text: fmt(t.auth.resetMailText, { link }) });
  }
  return NextResponse.json({ ok: true });
}
