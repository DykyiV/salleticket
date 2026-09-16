import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function DirectoryPage() {
  return (
    <SectionPlaceholder
      title="Довідник"
      description="Довідники для налаштування і кастомізації системи."
      features={[
        {
          text: "Міста → країни: базовий мапінг уже працює у фільтрі виїздів (lib/geo.ts).",
          done: true,
          href: "/admin/departures",
        },
        { text: "Перевізники: картки, рейтинг, комісія за замовчуванням, контакти." },
        { text: "Типи квитків і знижок (вікові категорії, пільги)." },
        { text: "Шаблони SMS / email / документів." },
      ]}
    />
  );
}
