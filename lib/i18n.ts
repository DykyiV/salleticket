"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Lang = "uk" | "en";

const KEY = "asol_lang";

const DICT = {
  uk: {
    from: "Звідки",
    to: "Куди",
    date: "Дата",
    search: "Знайти виїзд",
    ticketType: "Тип квитка",
    popular: "Популярні:",
  },
  en: {
    from: "From",
    to: "To",
    date: "Date",
    search: "Search trips",
    ticketType: "Ticket type",
    popular: "Popular:",
  },
} as const;

export function getLang(): Lang {
  if (typeof window === "undefined") return "uk";
  return window.localStorage.getItem(KEY) === "en" ? "en" : "uk";
}

export function t(lang: Lang, key: keyof (typeof DICT)["uk"]): string {
  return DICT[lang][key];
}

/** Subscribe to language changes from this tab (custom event) and other tabs (storage). */
function subscribeLang(onChange: () => void) {
  window.addEventListener("asol-lang", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("asol-lang", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Current UI language, backed by localStorage. Every component using this
 * hook re-renders when any of them switches language, so no extra listener
 * is needed (the previous useLangListener re-dispatched the same event from
 * inside its own handler, which recursed forever on a language switch).
 */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribeLang, getLang, (): Lang => "uk");
  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event("asol-lang"));
  }, []);
  return [lang, setLang];
}
