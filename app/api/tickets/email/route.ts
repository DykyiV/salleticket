import { NextResponse, type NextRequest } from "next/server";
import { sendMail } from "@/lib/mail";
import { boardingPassText, toBoardingPass } from "@/lib/tickets/boardingPass";
import { loadReadableBookings, PassAccessError } from "@/lib/tickets/passAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Email the boarding passes without requiring an account. */
export async function POST(req: NextRequest) {
  let body: { references?: string[]; email?: string };
  try {
    body = (await req.json()) as { references?: string[]; email?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Вкажіть коректний email" }, { status: 400 });
  }
  try {
    const bookings = await loadReadableBookings(req, body.references ?? []);
    const summary = bookings.map((booking) => boardingPassText(toBoardingPass(booking))).join("\n\n");
    const mail = await sendMail({
      to: email,
      subject: `Посадковий талон ${bookings.map((b) => b.reference).join(", ")}`,
      text: summary,
    });
    return NextResponse.json({
      delivered: mail.delivered,
      summary,
      message: mail.delivered
        ? "Посадковий талон надіслано на пошту."
        : "Пошта на сервері ще не підключена. Завантажте талон або відкрийте лист у своїй пошті.",
    });
  } catch (err) {
    if (err instanceof PassAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
