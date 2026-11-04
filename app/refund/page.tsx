import type { Metadata } from "next";
import InfoPage from "@/components/site/InfoPage";
import { getDict } from "@/lib/i18n/server";
import { getSiteContacts } from "@/lib/siteContacts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.pages.refundTitle} — Kaufmann Reisen`, description: t.pages.refundIntro };
}

export default async function RefundPage() {
  const [{ t }, contacts] = await Promise.all([getDict(), getSiteContacts()]);
  const email = contacts.email || "info@kaufmann-reisen.de";
  const body = t.legal.refund.body.map((line) => line.replace("{email}", email));
  return (
    <InfoPage
      t={t}
      title={t.pages.refundTitle}
      intro={t.pages.refundIntro}
      sections={[{ id: "refund", title: t.legal.refund.title, body }]}
    />
  );
}
