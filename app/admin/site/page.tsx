import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function SitePage() {
  return (
    <SectionPlaceholder
      title="Сайт"
      description="Керування HTML-сторінками, доступними на сайті."
      features={[
        { text: "Редагування статичних сторінок: про нас, допомога, контакти, правила перевезення." },
        { text: "SEO-поля (title, description) по сторінках." },
        { text: "Банери й оголошення на головній сторінці." },
      ]}
    />
  );
}
