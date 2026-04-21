export default function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Асоль Бус</h1>
      <h2>Продаж квитків онлайн</h2>

      <div style={{ marginTop: 20 }}>
        <input placeholder="Звідки" />
        <input placeholder="Куди" style={{ marginLeft: 10 }} />
        <input type="date" style={{ marginLeft: 10 }} />
        <button style={{ marginLeft: 10 }}>Знайти рейс</button>
      </div>
    </div>
  );
}
