// Тимчасові тестові дані рейсів. Пізніше замінити на запит до БД.
const FLIGHTS = [
  { id: 1, from: "Київ", to: "Львів", date: "2026-09-10", time: "08:00", price: 350 },
  { id: 2, from: "Київ", to: "Одеса", date: "2026-09-10", time: "12:30", price: 400 },
  { id: 3, from: "Львів", to: "Київ", date: "2026-09-11", time: "09:15", price: 350 },
  { id: 4, from: "Одеса", to: "Харків", date: "2026-09-12", time: "07:45", price: 500 },
];

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Метод не дозволено" });
  }

  const { from = "", to = "", date = "" } = req.query;

  const results = FLIGHTS.filter((flight) => {
    const matchesFrom = from ? flight.from.toLowerCase().includes(from.toLowerCase()) : true;
    const matchesTo = to ? flight.to.toLowerCase().includes(to.toLowerCase()) : true;
    const matchesDate = date ? flight.date === date : true;
    return matchesFrom && matchesTo && matchesDate;
  });

  res.status(200).json({ results });
}
