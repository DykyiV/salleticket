import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ContactInputError, DEFAULT_CONTACTS, getSiteContacts, updateSiteContacts, webHref, telHref } from "@/lib/siteContacts";

async function clean() {
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: "contact." } } });
}
beforeEach(clean);
afterAll(clean);

describe("site contacts", () => {
  it("starts from the defaults and stores edits; empty clears a field", async () => {
    expect(await getSiteContacts()).toEqual(DEFAULT_CONTACTS);
    const saved = await updateSiteContacts({ email: " help@asol.example ", phoneDe: "" });
    expect(saved.email).toBe("help@asol.example");
    expect(saved.phoneDe).toBe("");
    expect(saved.phoneUa).toBe(DEFAULT_CONTACTS.phoneUa);
  });

  it("rejects bad values and ignores unknown fields", async () => {
    await expect(updateSiteContacts({ email: "nope" })).rejects.toBeInstanceOf(ContactInputError);
    await expect(updateSiteContacts({ phoneUa: "call me" })).rejects.toBeInstanceOf(ContactInputError);
    await expect(updateSiteContacts({ website: 'x" onmouseover="y' })).rejects.toBeInstanceOf(ContactInputError);
    await updateSiteContacts({ evil: "x" });
    expect(await prisma.siteSetting.count({ where: { key: "contact.evil" } })).toBe(0);
  });

  it("builds links", () => {
    expect(telHref("+38 044 444 00 44")).toBe("tel:+380444440044");
    expect(webHref("grandes-tour.com.ua")).toBe("https://grandes-tour.com.ua");
    expect(webHref("https://x.ua")).toBe("https://x.ua");
  });
});
