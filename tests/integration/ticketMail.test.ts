import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { loadGroupBookings } from "@/lib/tickets/eTicket";
import { mailOrderWhenPaid, sendTicketsEmail } from "@/lib/tickets/ticketMail";

async function clean() {
  await prisma.payment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.user.deleteMany();
}

/** One order of two passengers, both waiting for an online payment. */
async function makeOrder() {
  const carrier = await prisma.carrier.create({ data: { name: "Asol BUS" } });
  const trip = await prisma.trip.create({
    data: {
      fromCity: "Київ",
      toCity: "Берлін",
      departureTime: new Date("2026-11-03T07:00:00Z"),
      arrivalTime: new Date("2026-11-04T06:00:00Z"),
      price: 90,
      carrierId: carrier.id,
    },
  });
  const user = await prisma.user.create({ data: { email: `m${Date.now()}@test.local`, password: "x" } });
  const refs = ["AB-70001", "AB-70002"];
  const tickets = [];
  for (const [i, reference] of refs.entries()) {
    const ticket = await prisma.ticket.create({
      data: { userId: user.id, tripId: trip.id, status: "AWAITING_PAYMENT", basePrice: 90, finalPrice: 85.5, seatNumber: i + 1 },
    });
    await prisma.booking.create({
      data: {
        reference,
        groupRef: refs[0],
        firstName: i ? "Marco" : "Elena",
        lastName: "Test",
        phone: "+34600111222",
        email: "buyer@example.com",
        lang: "es",
        finalPrice: 85.5,
        ticketId: ticket.id,
      },
    });
    tickets.push(ticket);
  }
  return { tickets, refs };
}

describe("ticket e-mail", () => {
  beforeEach(clean);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function provider() {
    vi.stubEnv("MAIL_PROVIDER", "brevo");
    vi.stubEnv("MAIL_API_KEY", "xkeysib-test");
    vi.stubEnv("MAIL_FROM", "Asol BUS <tickets@grandes-tour.com.ua>");
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ messageId: "<m1@brevo>" }), { status: 201 });
      })
    );
    return calls;
  }

  it("waits until the whole order is paid, then sends one letter with the PDF", async () => {
    const calls = provider();
    const { tickets } = await makeOrder();

    await prisma.ticket.update({ where: { id: tickets[0].id }, data: { status: "PAID_ONLINE" } });
    await mailOrderWhenPaid(tickets[0].id, "https://asol.test");
    expect(calls).toHaveLength(0);

    await prisma.ticket.update({ where: { id: tickets[1].id }, data: { status: "PAID_ONLINE" } });
    await mailOrderWhenPaid(tickets[1].id, "https://asol.test");
    expect(calls).toHaveLength(1);
    const body = calls[0].body as { to: { email: string }[]; subject: string; attachment: { name: string; content: string }[]; htmlContent: string };
    expect(body.to).toEqual([{ email: "buyer@example.com" }]);
    expect(body.subject).toBe("Tu billete AB-70001: Kiev → Berlín");
    expect(body.attachment[0].name).toBe("asolbus-AB-70001.pdf");
    expect(Buffer.from(body.attachment[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.htmlContent).toContain("AB-70002");

    const history = await prisma.ticketHistory.findMany({ where: { action: "EMAIL_SENT" } });
    expect(history).toHaveLength(2);
  });

  it("leaves cancelled passengers out and records an honest failure without a provider", async () => {
    vi.stubEnv("MAIL_PROVIDER", "");
    const { tickets, refs } = await makeOrder();
    await prisma.ticket.update({ where: { id: tickets[1].id }, data: { status: "CANCELLED" } });
    const res = await sendTicketsEmail(await loadGroupBookings(refs[1]));
    expect(res).toMatchObject({ delivered: false, configured: false, to: "buyer@example.com" });
    const rows = await prisma.ticketHistory.findMany();
    expect(rows.map((r) => [r.ticketId, r.action])).toEqual([[tickets[0].id, "EMAIL_FAILED"]]);
    expect(rows[0].changes).toContain("пошта не підключена");
  });
});
