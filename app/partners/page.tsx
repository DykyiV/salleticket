import StaticPage from "@/components/StaticPage";

export default function PartnersPage() {
  return (
    <StaticPage
      title="Партнери"
      subtitle="Перевізники та сервіси, з якими ми співпрацюємо."
    >
      <p>
        <em>
          Заповнювальний текст — тут з'являться логотипи та умови співпраці
          після підключення реальних партнерів-перевізників через API.
        </em>
      </p>
      <h2>Для перевізників</h2>
      <p>
        Якщо ви — автобусна компанія і хочете продавати квитки через Asol
        BUS, напишіть нам на{" "}
        <strong>partners@asolbus.example</strong> — ми розповімо, як
        підключити ваші рейси до нашої системи бронювання.
      </p>
    </StaticPage>
  );
}
