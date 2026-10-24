import { after } from "next/server";
import { prisma } from "@/lib/db";
import { isLang, type Lang } from "@/lib/i18n/config";
import { dictionaries } from "@/lib/i18n/dict";
import { fmt, localeOf, money } from "@/lib/i18n/format";
import { escapeHtml, mailConfigured, sendMail } from "@/lib/mail";
import { getSiteContacts } from "@/lib/siteContacts";
import { recordTicketHistory, type TicketHistorySource } from "@/lib/tickets/history";
import { buildTicketsPdf } from "@/lib/tickets/pdf";
import { loadGroupBookings, siteOrigin, toETicket, type ETicket, type ETicketBooking } from "@/lib/tickets/eTicket";
import { cityLabel } from "@/lib/trips/cities";

/**
 * The ticket e-mail: a short HTML letter in the buyer's language with every
 * passenger of the order and the A4 PDF attached. Goes only to the e-mail
 * given in the order — the site cannot be used to mail third parties.
 */

function when(at: string | null, lang: Lang): string {
  if (!at) return "—";
  const d = new Date(`${at.slice(0, 10)}T12:00:00Z`);
  const day = new Intl.DateTimeFormat(localeOf(lang), { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return `${day}, ${at.slice(11, 16)}`;
}

export function ticketMailContent(
  tickets: ETicket[],
  lang: Lang,
  origin: string,
  phone: string | null
): { subject: string; text: string; html: string } {
  const t = dictionaries[lang];
  const tt = t.ticket;
  const head = tickets[0];
  const out = head.journeys[0];
  const from = out ? cityLabel(out.from, lang) : "";
  const to = out ? cityLabel(out.to, lang) : "";
  const subject = fmt(tt.mail.subject, { ref: head.reference, from, to });
  const link = `${origin}/tickets/${encodeURIComponent(head.reference)}`;
  const name = head.firstName;

  const textLines = [fmt(tt.mail.greeting, { name }), "", tt.mail.intro, ""];
  const cards: string[] = [];
  for (const e of tickets) {
    const rows: string[] = [];
    textLines.push(`${e.firstName} ${e.lastName} — ${e.reference} — ${tt.status[e.state]}`);
    for (const j of e.journeys) {
      const seat = j.freeSeating ? tt.noSeat : fmt(tt.seatN, { n: j.seat ?? "" });
      const route = `${cityLabel(j.from, lang)} → ${cityLabel(j.to, lang)}`;
      const label = j.kind === "return" ? tt.return : tt.outbound;
      textLines.push(`  ${label}: ${route}, ${when(j.departAt, lang)}, ${tt.seat}: ${seat}`);
      if (j.boardAddress) textLines.push(`  ${tt.boarding}: ${j.boardAddress}`);
      rows.push(
        `<tr><td style="padding:10px 0 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(label)}</td></tr>` +
          `<tr><td style="padding:2px 0 0;font-size:16px;font-weight:700;color:#0B1F3A">${escapeHtml(route)}</td></tr>` +
          `<tr><td style="padding:2px 0 0;font-size:14px;color:#1F2937">${escapeHtml(when(j.departAt, lang))} · ${escapeHtml(tt.seat)}: ${escapeHtml(seat)}</td></tr>` +
          (j.boardAddress
            ? `<tr><td style="padding:2px 0 0;font-size:13px;color:#64748b">${escapeHtml(tt.boarding)}: ${escapeHtml(j.boardAddress)}</td></tr>`
            : "")
      );
    }
    const pay = e.toPay > 0 ? `${e.state === "due" ? tt.toPay : tt.status.pending}: ${money(e.toPay, lang)}` : tt.status[e.state];
    textLines.push(`  ${pay}`, "");
    cards.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:16px">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
        `<tr><td style="font-size:15px;font-weight:700;color:#0B1F3A">${escapeHtml(`${e.firstName} ${e.lastName}`)}</td>` +
        `<td align="right" style="font-family:monospace;font-size:14px;font-weight:700;color:#2563EB">${escapeHtml(e.reference)}</td></tr>` +
        `</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}` +
        `<tr><td style="padding:10px 0 0;font-size:14px;font-weight:700;color:${e.state === "paid" ? "#15803d" : e.state === "due" ? "#b45309" : "#1F2937"}">${escapeHtml(pay)}</td></tr>` +
        `</table></td></tr></table>`
    );
  }
  textLines.push(tt.arrive, "", `${tt.mail.open}: ${link}`);
  if (phone) textLines.push("", fmt(tt.mail.help, { phone }));

  const html =
    `<!doctype html><html lang="${lang}"><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#1F2937">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">` +
    `<tr><td style="background:#0B1F3A;padding:20px 24px;font-size:20px;font-weight:700;color:#ffffff">Asol <span style="color:#93c5fd">BUS</span></td></tr>` +
    `<tr><td style="padding:24px">` +
    `<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0B1F3A">${escapeHtml(fmt(tt.mail.greeting, { name }))}</p>` +
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(tt.mail.intro)}</p>` +
    cards.join("") +
    `<p style="margin:16px 0;padding:12px 14px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;font-size:14px;font-weight:700;line-height:1.45">${escapeHtml(tt.arrive)}</p>` +
    `<p style="margin:20px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${escapeHtml(tt.mail.open)}</a></p>` +
    (phone ? `<p style="margin:0;font-size:13px;color:#64748b">${escapeHtml(fmt(tt.mail.help, { phone }))}</p>` : "") +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject, text: textLines.join("\n"), html };
}

export type TicketMailResult = { delivered: boolean; configured: boolean; to: string | null };

/** Send the order's tickets (cancelled ones are left out) to the order e-mail. */
export async function sendTicketsEmail(
  bookings: ETicketBooking[],
  opts: { lang?: Lang; origin?: string; changedBy?: string | null; source?: TicketHistorySource } = {}
): Promise<TicketMailResult> {
  const active = bookings.filter((b) => b.ticket.status !== "CANCELLED" && b.ticket.status !== "REFUNDED");
  const to = active.find((b) => b.email)?.email?.trim() ?? null;
  const configured = mailConfigured();
  if (!active.length || !to) return { delivered: false, configured, to };

  const lang: Lang = opts.lang ?? (isLang(active[0].lang) ? active[0].lang : "uk");
  const origin = siteOrigin(opts.origin);
  const contacts = await getSiteContacts().catch(() => null);
  const phone = contacts?.phoneUa || contacts?.phoneEs || contacts?.phoneDe || null;
  const content = ticketMailContent(active.map((b) => toETicket(b, origin)), lang, origin, phone);
  const pdf = await buildTicketsPdf(active, origin, lang);
  const result = await sendMail({
    to,
    ...content,
    attachments: [{ filename: `asolbus-${active[0].reference}.pdf`, content: pdf }],
  });

  for (const b of active) {
    await recordTicketHistory(prisma, {
      ticketId: b.ticketId,
      action: result.delivered ? "EMAIL_SENT" : "EMAIL_FAILED",
      source: opts.source ?? "SYSTEM",
      changedBy: opts.changedBy ?? null,
      changes: {
        email: { from: null, to: result.delivered ? to : `${to} — ${configured ? result.error ?? "помилка" : "пошта не підключена"}` },
      },
    }).catch(() => undefined);
  }
  return { delivered: result.delivered, configured, to };
}

/** Run after the response when inside a request, right away otherwise. */
export function later(task: () => Promise<unknown>): void {
  const run = () => task().catch((err) => console.warn(`[ticket-mail] ${(err as Error).message}`));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** E-mail the whole order once every live ticket in it is paid. */
export async function mailOrderWhenPaid(ticketId: string, origin?: string): Promise<void> {
  const booking = await prisma.booking.findFirst({ where: { ticketId }, select: { reference: true } });
  if (!booking) return;
  const group = await loadGroupBookings(booking.reference);
  const live = group.filter((b) => b.ticket.status !== "CANCELLED" && b.ticket.status !== "REFUNDED");
  if (!live.length || live.some((b) => b.ticket.status !== "PAID_ONLINE" && b.ticket.status !== "PAID_CASH")) return;
  await sendTicketsEmail(live, { origin });
}
