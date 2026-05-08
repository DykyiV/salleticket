import { useState } from 'react';
import CityAutocomplete from '../components/CityAutocomplete';

export default function Home() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from.trim()) params.set('from', from.trim());
    if (to.trim()) params.set('to', to.trim());
    if (date) params.set('date', date);
    const q = params.toString();
    if (typeof window !== 'undefined') {
      window.alert(
        q
          ? `Пошук рейсів: ${from.trim() || '—'} → ${to.trim() || '—'}, дата: ${date || 'не обрано'}`
          : 'Оберіть хоча б місто відправлення або прибуття.'
      );
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <h1 className="site-title">Асоль Бус</h1>
          <p className="site-tagline">Продаж квитків онлайн</p>
        </div>
      </header>

      <main>
        <form className="search-card" onSubmit={handleSearch} noValidate>
          <h2 className="search-card__title">Знайти рейс</h2>

          <div className="form-grid">
            <CityAutocomplete
              id="city-from"
              label="Звідки"
              placeholder="Наприклад, Київ"
              value={from}
              onChange={setFrom}
            />
            <CityAutocomplete
              id="city-to"
              label="Куди"
              placeholder="Наприклад, Львів"
              value={to}
              onChange={setTo}
            />
          </div>

          <div className="form-row--date" style={{ marginTop: '1.25rem' }}>
            <label className="field-label" htmlFor="trip-date">
              Дата відправлення
            </label>
            <input
              id="trip-date"
              className="field-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Знайти рейс
            </button>
          </div>
        </form>
      </main>

      <footer className="site-footer">
        Оберіть місто: після першої літери з’являться варіанти; більше літер — вужчий список.
      </footer>
    </>
  );
}
