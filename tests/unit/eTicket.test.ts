import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { toETicket, ticketState, type ETicketBooking } from "@/lib/tickets/eTicket";
import { buildTicketsPdf } from "@/lib/tickets/pdf";
import { ticketMailContent } from "@/lib/tickets/ticketMail";
import { escapeHtml, parseAddress, providerRequest, sendMail } from "@/lib/mail";

const stop = (city: string, day: number, out: string, back: string, address: string | null) => ({
  city,
  addressLabel: null,
  boardingAddress: address,
  latitude: null,
  longitude: null,
  outboundDay: day,
  outboundTime: out,
  returnDay: day,
  returnTime: back,
  isVisible: true,
});

const departure = {
  date: new Date("2026-11-03T00:00:00Z"),
  defaultBus: "Setra",
  hasAssignedSeats: true,
  bus: { plate: "BC1234AA", model: "Neoplan" },
  template: { destinationCity: "Берлін" },
  stops: [
    stop("Київ", 1, "07:00", "20:00", "Автостанція «Київ», вул. Петлюри 32"),
    stop("Львів", 1, "15:30", "11:00", "Двірцева площа 1"),
    stop("Берлін", 2, "06:00", "08:00", "ZOB, Masurenallee 4"),
  ],
};

function booking(over: Partial<{ status: string; seat: number | null; from: string; to: string; reference: string; ret: boolean }> = {}) {
  const trip = {
    id: "t1",
    fromCity: "Київ",
    toCity: "Берлін",
    departureTime: new Date("2026-11-03T07:00:00Z"),
    arrivalTime: new Date("2026-11-04T06:00:00Z"),
    carrier: { name: "Asol BUS" },
    departure,
  };
  const returnTrip = {
    ...trip,
    id: "t2",
    fromCity: "Берлін",
    toCity: "Київ",
    departureTime: new Date("2026-11-10T08:00:00Z"),
    arrivalTime: new Date("2026-11-11T20:00:00Z"),
  };
  return {
    reference: over.reference ?? "AB-12345",
    groupRef: null,
    firstName: "Олена",
    lastName: "Коваль <b>",
    ageCategory: "ADULT",
    email: "olena@example.com",
    phone: "+380501112233",
    lang: "uk",
    createdAt: new Date("2026-10-24T10:00:00Z"),
    ticketId: "k1",
    ticket: {
      status: over.status ?? "RESERVED",
      finalPrice: 79.5,
      seatNumber: over.seat === undefined ? 12 : over.seat,
      returnSeatNumber: over.ret ? 7 : null,
      fromCity: over.from ?? "Львів",
      toCity: over.to ?? "Берлін",
      tripKind: over.ret ? "ROUND_TRIP" : "ONE_WAY",
      trip,
      returnTrip: over.ret ? returnTrip : null,
      assignment: null,
      legs: [],
      userId: "u1",
    },
  } as unknown as ETicketBooking;
}

describe("e-ticket model", () => {
  it("takes boarding and drop-off from the passenger's own stops", () => {
    const e = toETicket(booking(), "https://asol.test/");
    const j = e.journeys[0];
    expect(j.from).toBe("Львів");
    expect(j.departAt).toBe("2026-11-03T15:30");
    expect(j.boardAddress).toBe("Двірцева площа 1");
    expect(j.arriveAt).toBe("2026-11-04T06:00");
    expect(j.alightAddress).toBe("ZOB, Masurenallee 4");
    expect(j.boardMap).toContain("google.com/maps");
    expect(j.bus).toBe("Neoplan BC1234AA");
    expect(e.checkUrl).toBe("https://asol.test/check/AB-12345");
  });

  it("reads the return run backwards with its own times", () => {
    const e = toETicket(booking({ ret: true }), "https://asol.test");
    const back = e.journeys[1];
    expect(back.kind).toBe("return");
    expect(back.from).toBe("Берлін");
    expect(back.to).toBe("Львів");
    expect(back.departAt).toBe("2026-11-04T08:00");
    expect(back.seat).toBe(7);
  });

  it("maps statuses to what the passenger has to do", () => {
    expect(ticketState("RESERVED")).toBe("due");
    expect(ticketState("AWAITING_PAYMENT")).toBe("pending");
    expect(ticketState("PAID_CASH")).toBe("paid");
    expect(ticketState("PAID_ONLINE")).toBe("paid");
    expect(ticketState("CANCELLED")).toBe("cancelled");
    expect(toETicket(booking(), "x").toPay).toBe(79.5);
    expect(toETicket(booking({ status: "PAID_ONLINE" }), "x").toPay).toBe(0);
    expect(toETicket(booking({ seat: null }), "x").journeys[0].freeSeating).toBe(true);
  });
});

describe("ticket PDF", () => {
  it("prints one A4 page per passenger in each language", async () => {
    for (const lang of ["uk", "es", "en"] as const) {
      const bytes = await buildTicketsPdf([booking(), booking({ reference: "AB-54321", ret: true })], "https://asol.test", lang);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(2);
      const { width, height } = doc.getPage(0).getSize();
      expect(Math.round(width)).toBe(595);
      expect(Math.round(height)).toBe(842);
    }
  });
});

describe("ticket e-mail", () => {
  it("is written in the buyer's language and escapes names", () => {
    const e = toETicket(booking(), "https://asol.test");
    const uk = ticketMailContent([e], "uk", "https://asol.test", "+38 044 444 00 44");
    expect(uk.subject).toBe("Ваш квиток AB-12345: Львів → Берлін");
    expect(uk.html).toContain("https://asol.test/tickets/AB-12345");
    expect(uk.html).toContain("Коваль &lt;b&gt;");
    expect(uk.html).not.toContain("Коваль <b>");
    expect(uk.text).toContain("30–45");
    const es = ticketMailContent([e], "es", "https://asol.test", null);
    expect(es.subject).toBe("Tu billete AB-12345: Leópolis → Berlín");
  });
});

describe("mail providers", () => {
  const mail = { to: "a@b.c", subject: "S", text: "T", html: "<p>T</p>", attachments: [{ filename: "t.pdf", content: new Uint8Array([37, 80, 68, 70]) }] };

  it("builds Resend and Brevo requests", () => {
    const r = providerRequest("resend", mail, { key: "re_1", from: "Asol BUS <t@x.ua>", replyTo: "help@x.ua" });
    expect(r.url).toBe("https://api.resend.com/emails");
    expect(r.headers.Authorization).toBe("Bearer re_1");
    expect(r.body).toMatchObject({ from: "Asol BUS <t@x.ua>", to: ["a@b.c"], reply_to: "help@x.ua", attachments: [{ filename: "t.pdf", content: "JVBERg==" }] });

    const b = providerRequest("brevo", mail, { key: "xkeysib", from: "Asol BUS <t@x.ua>" });
    expect(b.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(b.headers["api-key"]).toBe("xkeysib");
    expect(b.body).toMatchObject({ sender: { name: "Asol BUS", email: "t@x.ua" }, to: [{ email: "a@b.c" }], htmlContent: "<p>T</p>", attachment: [{ name: "t.pdf", content: "JVBERg==" }] });
  });

  it("parses addresses and escapes HTML", () => {
    expect(parseAddress("Asol BUS <t@x.ua>")).toEqual({ name: "Asol BUS", email: "t@x.ua" });
    expect(parseAddress("t@x.ua")).toEqual({ email: "t@x.ua" });
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not pretend to deliver without a provider", async () => {
    vi.stubEnv("MAIL_PROVIDER", "");
    const res = await sendMail(mail);
    expect(res.delivered).toBe(false);
  });

  it("reports delivery only when the provider accepts the message", async () => {
    vi.stubEnv("MAIL_PROVIDER", "resend");
    vi.stubEnv("MAIL_API_KEY", "re_1");
    vi.stubEnv("MAIL_FROM", "Asol BUS <t@x.ua>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMail(mail)).toMatchObject({ delivered: true, id: "m1" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "bad from" }), { status: 422 }));
    expect(await sendMail(mail)).toMatchObject({ delivered: false, error: "HTTP 422" });
  });
});
