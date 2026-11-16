import { describe, expect, it } from "vitest";
import { LANGS } from "@/lib/i18n/config";
import { impressum, privacyPolicy } from "@/lib/legal/texts";

const contacts = { email: "info@kaufmann-reisen.de", phones: ["+49 721 95 944 124"] };
const all = (doc: ReturnType<typeof impressum>) => [doc.title, doc.intro, ...doc.sections.flatMap((s) => [s.title, ...s.paragraphs])].join("\n");

describe("Impressum (§ 5 DDG)", () => {
  it.each(LANGS)("names the company, its directors, register and contacts (%s)", (lang) => {
    const text = all(impressum(lang, contacts));
    for (const must of [
      "Kaufmann GmbH",
      "Bundesstraße 256 Nr. 10",
      "56637 Plaidt",
      "Vitalii Dykyi",
      "Viktor Kaufmann",
      "Amtsgericht Koblenz",
      "HRB 10391",
      "info@kaufmann-reisen.de",
      "+49 721 95 944 124",
      "https://kaufmann-reisen.de/datenschutz",
    ]) {
      expect(text).toContain(must);
    }
  });

  it("leaves out the VAT number while it is unknown and empty contact lines", () => {
    const doc = impressum("de", { email: "", phones: [] });
    expect(all(doc)).not.toMatch(/Umsatzsteuer/);
    expect(doc.sections.find((s) => s.id === "contact")?.paragraphs).toEqual([]);
  });

  it("marks the German text as the binding one in the translations", () => {
    expect(impressum("de", contacts).note).toBeUndefined();
    for (const lang of ["uk", "en", "es"] as const) expect(impressum(lang, contacts).note).toBeTruthy();
  });
});

describe("Datenschutzerklärung (Art. 13 DSGVO)", () => {
  it.each(LANGS)("has the same 13 sections in every language (%s)", (lang) => {
    const doc = privacyPolicy(lang, contacts);
    expect(doc.sections.map((s) => s.id)).toEqual(privacyPolicy("de", contacts).sections.map((s) => s.id));
    expect(doc.sections).toHaveLength(13);
    const text = all(doc);
    for (const must of [
      "Kaufmann GmbH",
      "info@kaufmann-reisen.de",
      "Hetzner Online GmbH",
      "Resend, Inc.",
      "Grandes Tour",
      "kaufmann_session",
      "kaufmann_visitor",
      "kaufmann_lang",
      "Hintere Bleiche 34, 55116 Mainz",
      "§ 257 HGB",
    ]) {
      expect(text).toContain(must);
    }
  });
});
