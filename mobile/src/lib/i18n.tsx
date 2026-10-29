import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getItem, setItem } from "@/lib/storage";

/**
 * Interface languages: Ukrainian (default), Spanish, English — the same set
 * and wording as the site.
 */
export const LANGS = ["uk", "es", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABEL: Record<Lang, { short: string; name: string; locale: string }> = {
  uk: { short: "UA", name: "Українська", locale: "uk-UA" },
  es: { short: "ES", name: "Español", locale: "es-ES" },
  en: { short: "EN", name: "English", locale: "en-GB" },
};

export type Plural = { one: string; few?: string; many?: string; other: string };

const uk = {
  common: {
    signIn: "Увійти",
    signOut: "Вийти",
    retry: "Спробувати ще раз",
    close: "Закрити",
    loading: "Завантаження…",
    openSite: "Відкрити сайт",
  },
  tabs: { tickets: "Квитки", profile: "Профіль" },
  list: {
    title: "Мої квитки",
    upcoming: "Майбутні поїздки",
    past: "Минулі та скасовані",
    empty: "Квитків поки немає.",
    emptyHint: "Квитки, куплені на сайті або в касі на ваш акаунт, з'являються тут самі.",
    findTrip: "Знайти рейс на сайті",
    signInTitle: "Увійдіть, щоб побачити свої квитки",
    signInHint: "Квитки зберігаються за e-mail, який ви вказали під час оформлення.",
    offline: "Немає зв'язку — показано збережені квитки.",
    error: "Не вдалося завантажити квитки.",
    passengersN: { one: "{n} пасажир", few: "{n} пасажири", many: "{n} пасажирів", other: "{n} пасажира" } as Plural,
  },
  ticket: {
    title: "Квиток",
    reference: "Номер квитка",
    passenger: "Пасажир",
    seat: "Місце",
    seatN: "№ {n}",
    noSeat: "вільна розсадка",
    bus: "Автобус",
    busTbd: "уточнюється",
    carrier: "Перевізник",
    boarding: "Посадка",
    dropoff: "Висадка",
    map: "На карті",
    outbound: "Туди",
    return: "Назад",
    openReturn: "Назад — відкрита дата",
    transfer: "Пересадка",
    price: "Вартість",
    toPay: "До сплати при посадці",
    paid: "Оплачено",
    status: {
      due: "Оплата при посадці",
      pending: "Очікує оплати",
      paid: "Оплачено",
      cancelled: "Скасовано",
      refunded: "Повернено",
    },
    arrive: "Приходьте на посадку за 30–45 хвилин до відправлення з документом, що посвідчує особу.",
    qrHint: "Покажіть QR-код водієві під час посадки.",
    issued: "Видано",
    notFound: "Квиток не знайдено",
    offline: "Немає зв'язку — показано збережений квиток.",
  },
  auth: {
    signInTitle: "Вхід",
    registerTitle: "Реєстрація",
    email: "E-mail",
    password: "Пароль",
    passwordHint: "Щонайменше 8 символів",
    submitSignIn: "Увійти",
    submitRegister: "Створити акаунт",
    toRegister: "Немає акаунта? Зареєструватися",
    toSignIn: "Вже є акаунт? Увійти",
    fill: "Вкажіть e-mail і пароль",
    shortPassword: "Пароль має містити щонайменше 8 символів",
    invalid: "Невірний e-mail або пароль",
    tooMany: "Забагато спроб. Спробуйте пізніше.",
    taken: "Не вдалося зареєструватися з цим e-mail. Якщо у вас уже є акаунт — увійдіть.",
    offline: "Немає зв'язку з сервером. Перевірте інтернет.",
    generic: "Не вдалося. Спробуйте ще раз.",
    guestHint: "Оформлювали квиток на сайті без пароля? Задайте пароль у кабінеті на сайті й увійдіть з ним тут.",
  },
  profile: {
    title: "Профіль",
    signedInAs: "Ви увійшли як",
    signedOutTitle: "Ви не увійшли",
    signedOutHint: "Увійдіть тим самим e-mail, що й на сайті, — і квитки будуть у телефоні.",
    language: "Мова",
    site: "Сайт",
    version: "Версія {v}",
    signOutHint: "Вихід завершує сесію на всіх пристроях, зокрема на сайті.",
  },
};

export type Dict = typeof uk;

const es: Dict = {
  common: {
    signIn: "Iniciar sesión",
    signOut: "Cerrar sesión",
    retry: "Reintentar",
    close: "Cerrar",
    loading: "Cargando…",
    openSite: "Abrir la web",
  },
  tabs: { tickets: "Billetes", profile: "Perfil" },
  list: {
    title: "Mis billetes",
    upcoming: "Próximos viajes",
    past: "Pasados y cancelados",
    empty: "Todavía no hay billetes.",
    emptyHint: "Los billetes comprados en la web o en taquilla con su cuenta aparecen aquí solos.",
    findTrip: "Buscar un viaje en la web",
    signInTitle: "Inicie sesión para ver sus billetes",
    signInHint: "Los billetes se guardan con el e-mail que indicó al comprar.",
    offline: "Sin conexión: se muestran los billetes guardados.",
    error: "No se pudieron cargar los billetes.",
    passengersN: { one: "{n} pasajero", other: "{n} pasajeros" },
  },
  ticket: {
    title: "Billete",
    reference: "Número de billete",
    passenger: "Pasajero",
    seat: "Asiento",
    seatN: "N.º {n}",
    noSeat: "asiento libre",
    bus: "Autobús",
    busTbd: "por confirmar",
    carrier: "Transportista",
    boarding: "Embarque",
    dropoff: "Bajada",
    map: "Ver en el mapa",
    outbound: "Ida",
    return: "Vuelta",
    openReturn: "Vuelta — fecha abierta",
    transfer: "Transbordo",
    price: "Precio",
    toPay: "A pagar al embarcar",
    paid: "Pagado",
    status: {
      due: "Pago al embarcar",
      pending: "Pendiente de pago",
      paid: "Pagado",
      cancelled: "Cancelado",
      refunded: "Reembolsado",
    },
    arrive: "Llegue al punto de embarque 30–45 minutos antes de la salida con un documento de identidad.",
    qrHint: "Muestre el código QR al conductor al embarcar.",
    issued: "Emitido",
    notFound: "Billete no encontrado",
    offline: "Sin conexión: se muestra el billete guardado.",
  },
  auth: {
    signInTitle: "Iniciar sesión",
    registerTitle: "Registro",
    email: "E-mail",
    password: "Contraseña",
    passwordHint: "Al menos 8 caracteres",
    submitSignIn: "Iniciar sesión",
    submitRegister: "Crear cuenta",
    toRegister: "¿No tiene cuenta? Regístrese",
    toSignIn: "¿Ya tiene cuenta? Inicie sesión",
    fill: "Indique e-mail y contraseña",
    shortPassword: "La contraseña debe tener al menos 8 caracteres",
    invalid: "E-mail o contraseña incorrectos",
    tooMany: "Demasiados intentos. Inténtelo más tarde.",
    taken: "No se pudo registrar con este e-mail. Si ya tiene cuenta, inicie sesión.",
    offline: "Sin conexión con el servidor. Compruebe internet.",
    generic: "No se pudo. Inténtelo de nuevo.",
    guestHint: "¿Compró en la web sin contraseña? Cree una contraseña en su cuenta de la web y úsela aquí.",
  },
  profile: {
    title: "Perfil",
    signedInAs: "Sesión iniciada como",
    signedOutTitle: "No ha iniciado sesión",
    signedOutHint: "Use el mismo e-mail que en la web y tendrá sus billetes en el móvil.",
    language: "Idioma",
    site: "Web",
    version: "Versión {v}",
    signOutHint: "Cerrar sesión la cierra en todos los dispositivos, también en la web.",
  },
};

const en: Dict = {
  common: {
    signIn: "Sign in",
    signOut: "Sign out",
    retry: "Try again",
    close: "Close",
    loading: "Loading…",
    openSite: "Open the website",
  },
  tabs: { tickets: "Tickets", profile: "Profile" },
  list: {
    title: "My tickets",
    upcoming: "Upcoming trips",
    past: "Past and cancelled",
    empty: "No tickets yet.",
    emptyHint: "Tickets bought on the website or at the office on your account show up here by themselves.",
    findTrip: "Find a trip on the website",
    signInTitle: "Sign in to see your tickets",
    signInHint: "Tickets are saved under the e-mail you gave at checkout.",
    offline: "No connection — showing saved tickets.",
    error: "Could not load your tickets.",
    passengersN: { one: "{n} passenger", other: "{n} passengers" },
  },
  ticket: {
    title: "Ticket",
    reference: "Ticket number",
    passenger: "Passenger",
    seat: "Seat",
    seatN: "No. {n}",
    noSeat: "free seating",
    bus: "Bus",
    busTbd: "to be confirmed",
    carrier: "Carrier",
    boarding: "Boarding",
    dropoff: "Drop-off",
    map: "Show on map",
    outbound: "Outbound",
    return: "Return",
    openReturn: "Return — open date",
    transfer: "Transfer",
    price: "Price",
    toPay: "To pay on boarding",
    paid: "Paid",
    status: {
      due: "Pay on boarding",
      pending: "Awaiting payment",
      paid: "Paid",
      cancelled: "Cancelled",
      refunded: "Refunded",
    },
    arrive: "Come to the boarding point 30–45 minutes before departure with an ID document.",
    qrHint: "Show the QR code to the driver when boarding.",
    issued: "Issued",
    notFound: "Ticket not found",
    offline: "No connection — showing the saved ticket.",
  },
  auth: {
    signInTitle: "Sign in",
    registerTitle: "Create account",
    email: "E-mail",
    password: "Password",
    passwordHint: "At least 8 characters",
    submitSignIn: "Sign in",
    submitRegister: "Create account",
    toRegister: "No account? Create one",
    toSignIn: "Already have an account? Sign in",
    fill: "Enter your e-mail and password",
    shortPassword: "The password must have at least 8 characters",
    invalid: "Wrong e-mail or password",
    tooMany: "Too many attempts. Please try again later.",
    taken: "Could not register with this e-mail. If you already have an account, sign in.",
    offline: "Can't reach the server. Check your internet connection.",
    generic: "Something went wrong. Please try again.",
    guestHint: "Bought on the website without a password? Set one in your account on the website and use it here.",
  },
  profile: {
    title: "Profile",
    signedInAs: "Signed in as",
    signedOutTitle: "You are not signed in",
    signedOutHint: "Use the same e-mail as on the website and your tickets will be on your phone.",
    language: "Language",
    site: "Website",
    version: "Version {v}",
    signOutHint: "Signing out ends the session on every device, the website included.",
  },
};

export const DICTS: Record<Lang, Dict> = { uk, es, en };

/** Spanish and English phones get their language, everyone else Ukrainian. */
export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === "es" || code === "en" ? code : "uk";
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** "{n} пасажири" with the right plural form. */
export function plural(lang: Lang, n: number, forms: Plural): string {
  let form = forms.other;
  if (lang === "uk") {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) form = forms.one;
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms.few ?? forms.other;
    else form = forms.many ?? forms.other;
  } else if (n === 1) {
    form = forms.one;
  }
  return fmt(form, { n });
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

const LANG_KEY = "gt_lang";

type Ctx = { lang: Lang; t: Dict; setLang: (lang: Lang) => void };

const I18nContext = createContext<Ctx>({ lang: "uk", t: uk, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);

  useEffect(() => {
    getItem(LANG_KEY).then((saved) => {
      if (isLang(saved)) setLangState(saved);
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void setItem(LANG_KEY, next);
  }, []);

  const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nContext);
}
