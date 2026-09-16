import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      title="Налаштування"
      description="Усі налаштування системи, доступні користувачу за його роллю."
      features={[
        {
          text: "Користувачі і права: ролі, «бачити всі квитки», «редагувати всі квитки».",
          done: true,
          href: "/admin/users",
        },
        {
          text: "Комісійні правила: відсоток агенства по перевізниках і напрямках.",
          done: true,
          href: "/admin/commissions",
        },
        {
          text: "Промокоди і знижки: відсоток, термін дії, ліміт використань.",
          done: true,
          href: "/admin/discounts",
        },
        { text: "Сервісний збір, валюта, контакти компанії." },
        { text: "Особисті налаштування: зміна пароля, мова інтерфейсу." },
      ]}
    />
  );
}
