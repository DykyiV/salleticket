import type { Metadata } from "next";
import InfoPage from "@/components/site/InfoPage";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.pages.rulesTitle} — Asol BUS`, description: t.pages.rulesIntro };
}

export default async function RulesPage() {
  const { t } = await getDict();
  return (
    <InfoPage
      t={t}
      title={t.pages.rulesTitle}
      intro={t.pages.rulesIntro}
      sections={[
        { id: "rights", ...t.legal.rights },
        { id: "offer", ...t.legal.offer },
        { id: "baggage", ...t.legal.baggage },
        { id: "privacy", title: t.pages.privacyTitle, body: [t.pages.privacyText] },
      ]}
    />
  );
}
