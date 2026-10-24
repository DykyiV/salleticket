import type { Metadata } from "next";
import InfoPage from "@/components/site/InfoPage";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.pages.baggageTitle} — Asol BUS`, description: t.pages.baggageIntro };
}

export default async function BaggagePage() {
  const { t } = await getDict();
  return (
    <InfoPage
      t={t}
      title={t.pages.baggageTitle}
      intro={t.pages.baggageIntro}
      sections={[{ id: "baggage", ...t.legal.baggage }]}
    />
  );
}
