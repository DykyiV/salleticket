import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Public contact details shown in the footer and on the support pages.
 * Edited by admins in Settings → «Контакти на сайті». Empty fields are
 * simply not shown.
 */
export type SiteContacts = {
  phoneUa: string;
  phoneEs: string;
  phoneDe: string;
  email: string;
  website: string;
  address: string;
  facebook: string;
  instagram: string;
  telegram: string;
  viber: string;
  whatsapp: string;
};

export const CONTACT_FIELDS = Object.keys({
  phoneUa: 1, phoneEs: 1, phoneDe: 1, email: 1, website: 1, address: 1,
  facebook: 1, instagram: 1, telegram: 1, viber: 1, whatsapp: 1,
} satisfies Record<keyof SiteContacts, 1>) as (keyof SiteContacts)[];

/** Starting values — the numbers printed on the Grandes Tour coaches. */
export const DEFAULT_CONTACTS: SiteContacts = {
  phoneUa: "+38 044 444 00 44",
  phoneEs: "+34 919 938 888",
  phoneDe: "+49 721 959 441 24",
  email: "",
  website: "grandes-tour.com.ua",
  address: "",
  facebook: "",
  instagram: "",
  telegram: "",
  viber: "",
  whatsapp: "",
};

const PREFIX = "contact.";
const MAX_LEN = 200;

type Db = PrismaClient | Prisma.TransactionClient;

export async function getSiteContacts(db: Db = prisma): Promise<SiteContacts> {
  const out: SiteContacts = { ...DEFAULT_CONTACTS };
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    for (const row of rows) {
      const field = row.key.slice(PREFIX.length) as keyof SiteContacts;
      if (CONTACT_FIELDS.includes(field)) out[field] = row.value;
    }
  } catch {
    // Footer must render even if the database is unavailable.
  }
  return out;
}

export class ContactInputError extends Error {}

/** Validates and stores the fields present in `patch`; "" clears a field. */
export async function updateSiteContacts(patch: Record<string, unknown>, db: Db = prisma): Promise<SiteContacts> {
  for (const field of CONTACT_FIELDS) {
    if (!(field in patch)) continue;
    const raw = patch[field];
    if (typeof raw !== "string") throw new ContactInputError(`«${field}» має бути текстом`);
    const value = raw.trim();
    if (value.length > MAX_LEN) throw new ContactInputError(`«${field}» задовге`);
    if (value && field === "email" && !/^\S+@\S+\.\S+$/.test(value)) {
      throw new ContactInputError("Некоректний e-mail");
    }
    if (value && /^(phone|viber|whatsapp)/.test(field) && !/^[+\d][\d\s()-]{5,}$/.test(value)) {
      throw new ContactInputError(`Некоректний номер у полі «${field}»`);
    }
    if (value && ["website", "facebook", "instagram", "telegram"].includes(field) && /[\s<>"']/.test(value)) {
      throw new ContactInputError(`Некоректне посилання у полі «${field}»`);
    }
    await db.siteSetting.upsert({
      where: { key: PREFIX + field },
      create: { key: PREFIX + field, value },
      update: { value },
    });
  }
  return getSiteContacts(db);
}

/** tel: link for a printed phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Absolute https link for a site / profile typed without a scheme. */
export function webHref(value: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

/** Messenger deep links from a phone number. */
export function viberHref(phone: string): string {
  return `viber://chat?number=${encodeURIComponent(phone.replace(/[^\d+]/g, ""))}`;
}
export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
export function telegramHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://t.me/${value.replace(/^@/, "")}`;
}
