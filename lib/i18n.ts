"use client";

import { useEffect, useState } from "react";

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

export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("uk");
  useEffect(() => {
    setLangState(getLang());
  }, []);
  const setLang = (next: Lang) => {
    window.localStorage.setItem(KEY, next);
    setLangState(next);
    window.dispatchEvent(new Event("asol-lang"));
  };
  return [lang, setLang];
}

export function useLangListener(setLang: (lang: Lang) => void) {
  useEffect(() => {
    const handler = () => setLang(getLang());
    window.addEventListener("asol-lang", handler);
    return () => window.removeEventListener("asol-lang", handler);
  }, [setLang]);
}
