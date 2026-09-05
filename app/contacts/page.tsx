import StaticPage from "@/components/StaticPage";

export default function ContactsPage() {
  return (
    <StaticPage
      title="Контакти"
      subtitle="Зв'яжіться з нами будь-яким зручним способом."
    >
      <p>
        <em>
          Заповнювальний текст — підставте реальні контактні дані компанії.
        </em>
      </p>
      <h2>Кол-центр</h2>
      <p>
        Телефон: <strong>+380 XX XXX XX XX</strong> (щодня, 08:00–20:00)
        <br />
        Email: <strong>info@asolbus.example</strong>
      </p>
      <h2>Головний офіс</h2>
      <p>м. Вінниця, вул. Прикладна, 1</p>
      <h2>Соціальні мережі</h2>
      <ul>
        <li>Facebook</li>
        <li>Instagram</li>
        <li>Telegram</li>
      </ul>
    </StaticPage>
  );
}
