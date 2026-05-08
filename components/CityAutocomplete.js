import { useState, useRef, useEffect, useCallback } from 'react';
import { citiesMatchingPrefix } from '../lib/cities';

export default function CityAutocomplete({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete = 'off',
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const suggestions = citiesMatchingPrefix(value);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(0);
  }, []);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        close();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [close]);

  useEffect(() => {
    if (highlight >= suggestions.length) {
      setHighlight(Math.max(0, suggestions.length - 1));
    }
  }, [highlight, suggestions.length]);

  function pickCity(city) {
    onChange(city);
    close();
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && value.trim().length >= 1) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      pickCity(suggestions[highlight]);
    }
  }

  const showList = open && value.trim().length >= 1 && suggestions.length > 0;

  return (
    <div className="field-wrap" ref={wrapRef}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          if (value.trim().length >= 1) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
      />
      {showList ? (
        <ul
          id={`${id}-listbox`}
          className="suggestions"
          role="listbox"
        >
          {suggestions.map((city, i) => (
            <li key={city} role="none">
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'active' : ''}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCity(city)}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
