import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  return (
    <SectionPlaceholder
      title="Статистика"
      description="Аналітика продажів у розрізах."
      features={[
        { text: "Продажі по перевізниках: квитки, оборот, комісія." },
        { text: "Продажі по агентах: хто скільки продав і заробив." },
        { text: "Продажі по країнах і містах." },
        { text: "Графіки по днях/місяцях, топ-напрямки." },
      ]}
    />
  );
}
