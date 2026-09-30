import { createHash } from "crypto";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { TICKET_BRIEF } from "@/lib/legal";
import type { ETicketModel } from "@/lib/tickets/eTicket";
import { solidPng } from "@/lib/tickets/solidPng";

const exec = promisify(execFile);
const BRAND: [number, number, number] = [19, 73, 196];
const WHITE: [number, number, number] = [255, 255, 255];

export class ApplePassNotConfigured extends Error {
  constructor() {
    super("Apple Wallet не налаштовано");
    this.name = "ApplePassNotConfigured";
  }
}

export function applePassConfigured(): boolean {
  return Boolean(
    process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_CERT &&
      process.env.APPLE_PASS_KEY &&
      process.env.APPLE_WWDR_CERT
  );
}

type PassField = { key: string; label: string; value: string };

/** Compact boarding pass: cities, times, seat, passenger, price, and the same QR as the printed ticket. */
export function applePassJson(ticket: ETicketModel, checkUrl: string): Record<string, unknown> {
  const seat = (ticket.segments[0]?.seat ?? "—").replace(/^місце\s+/i, "");
  const bus = ticket.segments.map((segment) => segment.bus).filter(Boolean).join("; ") || "—";
  const field = (key: string, label: string, value: string): PassField => ({ key, label, value: value || "—" });
  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.com.asolbus.ticket",
    serialNumber: ticket.reference,
    teamIdentifier: process.env.APPLE_TEAM_ID || "TEAMID",
    organizationName: "Asol BUS",
    description: `Електронний квиток ${ticket.reference}`,
    logoText: "Asol BUS",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(19, 73, 196)",
    labelColor: "rgb(188, 218, 255)",
    barcode: {
      message: checkUrl,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: ticket.reference,
    },
    barcodes: [
      {
        message: checkUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: ticket.reference,
      },
    ],
    boardingPass: {
      transitType: "PKTransitTypeBus",
      headerFields: [field("seat", "МІСЦЕ", seat)],
      primaryFields: [field("from", "ЗВІДКИ", ticket.routeFrom), field("to", "КУДИ", ticket.routeTo)],
      secondaryFields: [field("depart", "ВИЇЗД", ticket.depart), field("arrive", "ПРИБУТТЯ", ticket.arrive)],
      auxiliaryFields: [field("passenger", "ПАСАЖИР", ticket.passenger), field("price", "ВАРТІСТЬ", ticket.price)],
      backFields: [
        field("bus", "Автобус", bus),
        field("phones", "Телефони", ticket.phones),
        field("baggage", "Багаж", TICKET_BRIEF.baggage),
        field("refund", "Повернення", TICKET_BRIEF.refund),
      ],
    },
  };
}

async function sha1File(file: string): Promise<string> {
  const bytes = await readFile(file);
  return createHash("sha1").update(bytes).digest("hex");
}

/** Signed .pkpass. Throws when the Apple certificates are not in the environment. */
export async function buildApplePass(ticket: ETicketModel, checkUrl: string): Promise<Buffer> {
  if (!applePassConfigured()) throw new ApplePassNotConfigured();
  const dir = await mkdtemp(path.join(tmpdir(), "asol-pass-"));
  try {
    const files = ["pass.json", "icon.png", "icon@2x.png", "logo.png", "logo@2x.png"];
    await writeFile(path.join(dir, "pass.json"), JSON.stringify(applePassJson(ticket, checkUrl)));
    await writeFile(path.join(dir, "icon.png"), solidPng(29, 29, BRAND));
    await writeFile(path.join(dir, "icon@2x.png"), solidPng(58, 58, BRAND));
    await writeFile(path.join(dir, "logo.png"), solidPng(48, 48, WHITE));
    await writeFile(path.join(dir, "logo@2x.png"), solidPng(96, 96, WHITE));
    const manifest: Record<string, string> = {};
    for (const name of files) manifest[name] = await sha1File(path.join(dir, name));
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
    const cert = process.env.APPLE_PASS_CERT!.replace(/\\n/g, "\n");
    const key = process.env.APPLE_PASS_KEY!.replace(/\\n/g, "\n");
    const wwdr = process.env.APPLE_WWDR_CERT!.replace(/\\n/g, "\n");
    await writeFile(path.join(dir, "cert.pem"), cert);
    await writeFile(path.join(dir, "key.pem"), key);
    await writeFile(path.join(dir, "wwdr.pem"), wwdr);
    await exec("openssl", [
      "smime",
      "-binary",
      "-sign",
      "-certfile",
      "wwdr.pem",
      "-signer",
      "cert.pem",
      "-inkey",
      "key.pem",
      "-in",
      "manifest.json",
      "-out",
      "signature",
      "-outform",
      "DER",
    ], { cwd: dir });
    const zipPath = path.join(dir, "ticket.pkpass");
    await exec("zip", ["-q", "-r", "-X", zipPath, "pass.json", "manifest.json", "signature", ...files], { cwd: dir });
    return await readFile(zipPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
