import SectionPlaceholder from "@/components/admin/SectionPlaceholder";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <SectionPlaceholder
      title="Чат"
      description="Чат-боти і розсилки: спілкування з пасажирами в месенджерах і SMS."
      features={[
        {
          text: "SMS-канал: масові й одиночні відправки з історією в квитку (mock-адаптер, готовий до підключення TurboSMS/Twilio).",
          done: true,
          href: "/admin/tickets",
        },
        { text: "Сценарії чат-бота: FAQ, статус броні за референсом." },
        { text: "SendPulse інтеграція: API-ключ, ланцюжки повідомлень." },
        { text: "Viber і WhatsApp канали: вибір провайдера, шаблони." },
      ]}
    />
  );
}
