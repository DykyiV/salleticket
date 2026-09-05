import { useState } from "react";

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ from, to, date });
      const res = await fetch(`/api/flights?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Не вдалося отримати список рейсів");
      }

      const data = await res.json();
      setFlights(data.results);
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Асоль Бус</h1>
      <h2>Продаж квитків онлайн</h2>

      <form onSubmit={handleSearch} style={{ marginTop: 20 }}>
        <input
          placeholder="Звідки"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          placeholder="Куди"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ marginLeft: 10 }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginLeft: 10 }}
        />
        <button type="submit" disabled={loading} style={{ marginLeft: 10 }}>
          {loading ? "Пошук..." : "Знайти рейс"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}

      {searched && !error && (
        <div style={{ marginTop: 30 }}>
          {flights.length === 0 ? (
            <p>Рейсів за вашим запитом не знайдено.</p>
          ) : (
            <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th>Звідки</th>
                  <th>Куди</th>
                  <th>Дата</th>
                  <th>Час</th>
                  <th>Ціна</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => (
                  <tr key={flight.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{flight.from}</td>
                    <td>{flight.to}</td>
                    <td>{flight.date}</td>
                    <td>{flight.time}</td>
                    <td>{flight.price} грн</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
