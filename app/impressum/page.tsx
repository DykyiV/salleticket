import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { getDict } from "@/lib/i18n/server";
import { legalContacts } from "@/lib/legal/contacts";
import { impressum } from "@/lib/legal/texts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getDict();
  const doc = impressum(lang, await legalContacts());
  return { title: `${doc.title} — Kaufmann Reisen`, description: doc.intro };
}

export default async function ImpressumPage() {
  const { lang, t } = await getDict();
  return <LegalPage t={t} doc={impressum(lang, await legalContacts())} />;
}
