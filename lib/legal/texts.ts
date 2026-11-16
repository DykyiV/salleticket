import type { Lang } from "@/lib/i18n/config";
import { COMPANY } from "@/lib/legal/company";

/**
 * Impressum (§ 5 DDG) and privacy policy (Art. 13 DSGVO) in the four site
 * languages. The German text is the binding one. Kept out of the UI
 * dictionaries so the long texts are not sent with every page.
 */

export type LegalSection = { id: string; title: string; paragraphs: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[]; note?: string };
export type LegalContacts = { email: string; phones: string[] };

const C = COMPANY;
const ADDRESS = `${C.street}, ${C.zip} ${C.city}`;
const MANAGERS = C.managers.join(", ");
const SUPERVISOR = "Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz, Hintere Bleiche 34, 55116 Mainz, https://www.datenschutz.rlp.de";
const HETZNER = "Hetzner Online GmbH, Industriestraße 25, 91710 Gunzenhausen";
const RESEND = "Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA";
const IONOS = "IONOS SE, Elgendorfer Straße 57, 56410 Montabaur";
const GOOGLE = "Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland";

const phonesOf = (c: LegalContacts) => c.phones.join(", ");

// ─────────────────────────── Impressum ───────────────────────────

export function impressum(lang: Lang, c: LegalContacts): LegalDoc {
  const L = {
    de: {
      title: "Impressum",
      intro: "Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).",
      provider: "Anbieter",
      brand: `${C.brand} ist ein Angebot der ${C.name}.`,
      country: "Deutschland",
      reps: "Vertreten durch",
      repsLine: `Geschäftsführer: ${MANAGERS} (jeweils einzelvertretungsberechtigt)`,
      contact: "Kontakt",
      phone: "Telefon",
      email: "E-Mail",
      register: "Registereintrag",
      court: "Registergericht",
      number: "Registernummer",
      vat: "Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG",
      disputes: "Verbraucherstreitbeilegung",
      disputesText:
        "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
      privacy: "Datenschutz",
      privacyText: "Wie wir mit Ihren Daten umgehen, lesen Sie in der Datenschutzerklärung: https://kaufmann-reisen.de/datenschutz",
      note: undefined,
    },
    uk: {
      title: "Impressum (вихідні дані)",
      intro: "Відомості про власника сайту згідно з § 5 німецького Закону про цифрові послуги (DDG).",
      provider: "Власник сайту",
      brand: `${C.brand} — сервіс компанії ${C.name}.`,
      country: "Німеччина",
      reps: "Представники",
      repsLine: `Директори (Geschäftsführer): ${MANAGERS}, кожен має право представляти компанію одноосібно`,
      contact: "Контакти",
      phone: "Телефон",
      email: "E-mail",
      register: "Реєстрація",
      court: "Реєстраційний суд",
      number: "Реєстраційний номер",
      vat: "Номер платника ПДВ (USt-IdNr.)",
      disputes: "Позасудове врегулювання спорів зі споживачами",
      disputesText:
        "Ми не беремо участі й не зобовʼязані брати участь у процедурах урегулювання спорів у споживчій арбітражній установі (Verbraucherschlichtungsstelle).",
      privacy: "Захист даних",
      privacyText: "Як ми обробляємо ваші дані, описано в політиці конфіденційності: https://kaufmann-reisen.de/datenschutz",
      note: "Юридично обовʼязковою є німецька версія цієї сторінки.",
    },
    en: {
      title: "Legal notice (Impressum)",
      intro: "Information pursuant to § 5 of the German Digital Services Act (DDG).",
      provider: "Provider",
      brand: `${C.brand} is a service of ${C.name}.`,
      country: "Germany",
      reps: "Represented by",
      repsLine: `Managing directors (Geschäftsführer): ${MANAGERS}, each authorised to represent the company alone`,
      contact: "Contact",
      phone: "Phone",
      email: "E-mail",
      register: "Commercial register",
      court: "Register court",
      number: "Register number",
      vat: "VAT identification number (§ 27a UStG)",
      disputes: "Consumer dispute resolution",
      disputesText:
        "We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.",
      privacy: "Data protection",
      privacyText: "How we handle your data is described in our privacy policy: https://kaufmann-reisen.de/datenschutz",
      note: "The German version of this page is legally binding.",
    },
    es: {
      title: "Aviso legal (Impressum)",
      intro: "Información conforme al § 5 de la Ley alemana de Servicios Digitales (DDG).",
      provider: "Titular",
      brand: `${C.brand} es un servicio de ${C.name}.`,
      country: "Alemania",
      reps: "Representada por",
      repsLine: `Administradores (Geschäftsführer): ${MANAGERS}, cada uno con facultad de representación individual`,
      contact: "Contacto",
      phone: "Teléfono",
      email: "Correo electrónico",
      register: "Registro mercantil",
      court: "Tribunal de registro",
      number: "Número de registro",
      vat: "Número de identificación a efectos del IVA (§ 27a UStG)",
      disputes: "Resolución de litigios de consumo",
      disputesText:
        "No estamos dispuestos ni obligados a participar en procedimientos de resolución de litigios ante una entidad de arbitraje de consumo.",
      privacy: "Protección de datos",
      privacyText: "Cómo tratamos sus datos se explica en la política de privacidad: https://kaufmann-reisen.de/datenschutz",
      note: "La versión alemana de esta página es la jurídicamente vinculante.",
    },
  }[lang];

  const contact = [
    ...(c.phones.length ? [`${L.phone}: ${phonesOf(c)}`] : []),
    ...(c.email ? [`${L.email}: ${c.email}`] : []),
  ];
  return {
    title: L.title,
    intro: L.intro,
    note: L.note,
    sections: [
      { id: "provider", title: L.provider, paragraphs: [C.name, C.street, `${C.zip} ${C.city}`, L.country, L.brand] },
      { id: "representatives", title: L.reps, paragraphs: [L.repsLine] },
      { id: "contact", title: L.contact, paragraphs: contact },
      {
        id: "register",
        title: L.register,
        paragraphs: [
          `${L.court}: ${C.registerCourt}`,
          `${L.number}: ${C.registerNumber}`,
          ...(C.vatId ? [`${L.vat}: ${C.vatId}`] : []),
        ],
      },
      { id: "disputes", title: L.disputes, paragraphs: [L.disputesText] },
      { id: "privacy", title: L.privacy, paragraphs: [L.privacyText] },
    ],
  };
}

// ─────────────────────────── Datenschutzerklärung ───────────────────────────

export function privacyPolicy(lang: Lang, c: LegalContacts): LegalDoc {
  const contact = [c.email, phonesOf(c)].filter(Boolean).join(", ");
  const docs: Record<Lang, LegalDoc> = {
    de: {
      title: "Datenschutzerklärung",
      intro: "Wie wir Ihre personenbezogenen Daten verarbeiten – Informationen nach Art. 13 und 14 der Datenschutz-Grundverordnung (DSGVO). Stand: November 2026.",
      sections: [
        {
          id: "controller",
          title: "1. Verantwortlicher",
          paragraphs: [
            `Verantwortlich für die Datenverarbeitung auf kaufmann-reisen.de ist die ${C.name}, ${ADDRESS}, Deutschland, vertreten durch die Geschäftsführer ${MANAGERS}.`,
            `Kontakt: ${contact}. Für Fragen zum Datenschutz und zur Ausübung Ihrer Rechte genügt eine formlose Nachricht an diese Adresse.`,
          ],
        },
        {
          id: "hosting",
          title: "2. Hosting und Server-Protokolle",
          paragraphs: [
            `Die Website läuft auf einem Server der ${HETZNER}, im Rechenzentrum Falkenstein (Deutschland). Hetzner verarbeitet die Daten in unserem Auftrag (Art. 28 DSGVO).`,
            "Bei jedem Seitenaufruf speichert der Webserver automatisch: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Statuscode, übertragene Datenmenge, zuvor besuchte Seite (Referrer) und Browserkennung (User-Agent). Wir benötigen diese Daten, um die Website sicher und störungsfrei zu betreiben und Angriffe zu erkennen (Art. 6 Abs. 1 lit. f DSGVO). Die Protokolle werden nach 14 Tagen automatisch gelöscht.",
            "Alle Verbindungen zur Website sind per TLS (https) verschlüsselt.",
          ],
        },
        {
          id: "cookies",
          title: "3. Cookies",
          paragraphs: [
            "Wir verwenden nur Cookies, die für die Funktion der Website unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG); dafür ist keine Einwilligung nötig. Analyse-, Werbe- oder Tracking-Cookies setzen wir nicht ein, und wir binden keine Dienste Dritter ein, die Ihren Besuch verfolgen.",
            "kaufmann_session – hält Sie nach der Anmeldung angemeldet; wird beim Abmelden gelöscht, spätestens nach 7 Tagen.",
            "kaufmann_visitor – ordnet die während der Platzwahl vorgemerkten Sitzplätze Ihrem Browser zu; Laufzeit 7 Tage.",
            "kaufmann_lang – speichert die gewählte Sprache; Laufzeit 1 Jahr.",
          ],
        },
        {
          id: "account",
          title: "4. Kundenkonto",
          paragraphs: [
            "Für Buchungen und den Zugriff auf Ihre Fahrkarten wird ein Kundenkonto angelegt – bei der Registrierung oder bei der ersten Buchung. Wir speichern Ihre E-Mail-Adresse und Ihr Passwort (nur als verschlüsselter Hashwert) sowie, falls Sie sie angeben, Anzeigename und Profilbild.",
            "Rechtsgrundlage ist die Durchführung des Vertrags und vorvertraglicher Maßnahmen (Art. 6 Abs. 1 lit. b DSGVO). Sie können Ihr Konto jederzeit löschen lassen; Buchungsunterlagen, die wir aufbewahren müssen, bleiben bis zum Ende der gesetzlichen Fristen gespeichert (Abschnitt 11).",
          ],
        },
        {
          id: "booking",
          title: "5. Buchung von Fahrkarten",
          paragraphs: [
            "Für eine Buchung verarbeiten wir zu jedem Fahrgast: Vor- und Nachname (in lateinischer Schrift wie im Reisepass), Telefonnummer, E-Mail-Adresse, Fahrgastkategorie bzw. Geburtsdatum (für Ermäßigungen), gegebenenfalls die Nummer einer Kundenkarte sowie Strecke, Datum, Sitzplatz, Preis und Zahlungsstatus.",
            "Wir benötigen diese Daten, um die Fahrkarte auszustellen, den Platz beim Busunternehmen zu reservieren, Sie über Änderungen Ihrer Fahrt zu informieren und Erstattungen abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO). Ohne diese Angaben ist eine Buchung nicht möglich.",
            "Bezahlt wird derzeit beim Einstieg in den Bus oder bei unseren Agenten; eine Online-Zahlung bieten wir zurzeit nicht an.",
            "Unsere Mitarbeiter und Agenten sehen nur die Buchungen, die sie für ihre Arbeit brauchen, etwa die von ihnen verkauften Fahrkarten.",
          ],
        },
        {
          id: "carrier",
          title: "6. Weitergabe an das Busunternehmen (Grandes Tour)",
          paragraphs: [
            "Die Fahrten führt das Busunternehmen Grandes Tour (grandes-tour.com.ua) durch. Damit Ihr Platz im Bus reserviert ist und Sie beim Einstieg erkannt werden, übermitteln wir an Grandes Tour: Vor- und Nachname, Telefonnummer, Strecke, Datum, Sitzplatz, Fahrgastkategorie und gegebenenfalls die Kundenkartennummer. Grandes Tour verarbeitet diese Daten als eigener Verantwortlicher (Art. 6 Abs. 1 lit. b DSGVO).",
            "Die Fahrten verbinden die EU mit der Ukraine, und Grandes Tour ist auch in der Ukraine tätig. Dabei können Daten in die Ukraine übermittelt werden, für die kein Angemessenheitsbeschluss der EU-Kommission besteht. Die Übermittlung ist zur Erfüllung des Beförderungsvertrags erforderlich (Art. 49 Abs. 1 lit. b DSGVO).",
          ],
        },
        {
          id: "email",
          title: "7. E-Mails",
          paragraphs: [
            `Fahrkarten, Buchungsbestätigungen, Hinweise zu Ihrer Fahrt und Links zum Zurücksetzen des Passworts versenden wir über den Dienst ${RESEND}, der in unserem Auftrag tätig ist (Art. 28 DSGVO). Verarbeitet werden dabei Ihre E-Mail-Adresse, der Inhalt der Nachricht und technische Zustelldaten. Resend speichert Daten in den USA; das Unternehmen ist nach dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO), zusätzlich gelten die EU-Standardvertragsklauseln.`,
            `Unser E-Mail-Postfach wird von der ${IONOS}, Deutschland, betrieben. Werbe-E-Mails oder Newsletter versenden wir nicht.`,
          ],
        },
        {
          id: "contact",
          title: "8. Kontaktaufnahme",
          paragraphs: [
            "Wenn Sie uns per E-Mail, Telefon oder Messenger kontaktieren, verarbeiten wir Ihre Angaben, um Ihre Anfrage zu beantworten – bei Fragen zu einer Buchung nach Art. 6 Abs. 1 lit. b DSGVO, sonst nach Art. 6 Abs. 1 lit. f DSGVO.",
            "Nutzen Sie WhatsApp, Viber oder Telegram, gelten zusätzlich die Datenschutzbestimmungen des jeweiligen Anbieters; diese Dienste können Daten auch außerhalb der EU verarbeiten. Wenn Sie das nicht möchten, schreiben Sie uns bitte eine E-Mail oder rufen Sie an.",
          ],
        },
        {
          id: "security",
          title: "9. Sicherheit und Schutz vor Missbrauch",
          paragraphs: [
            "Um Missbrauch zu verhindern, etwa das automatische Durchprobieren von Passwörtern oder massenhafte Buchungen, zählen wir Anfragen je IP-Adresse bzw. E-Mail-Adresse. Dafür speichern wir nur einen nicht umkehrbaren Hashwert; er verliert nach höchstens einer Stunde seine Wirkung und wird danach gelöscht (Art. 6 Abs. 1 lit. f DSGVO).",
            "Bei Änderungen an einer Buchung protokollieren wir, wer sie wann vorgenommen hat, einschließlich IP-Adresse und Browserkennung, um Fehler und Missbrauch nachvollziehen zu können (Art. 6 Abs. 1 lit. f DSGVO). Das Protokoll wird zusammen mit der Buchung gespeichert.",
          ],
        },
        {
          id: "links",
          title: "10. Links zu Google Maps und Google Wallet",
          paragraphs: [
            `Zu Haltestellen verlinken wir auf Google Maps, zu Fahrkarten auf Google Wallet. Erst wenn Sie einen solchen Link anklicken, verarbeitet ${GOOGLE}, Ihre Daten nach den eigenen Bestimmungen. Beim bloßen Besuch unserer Seiten wird keine Verbindung zu Google hergestellt.`,
          ],
        },
        {
          id: "storage",
          title: "11. Speicherdauer",
          paragraphs: [
            "Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist. Buchungs- und Abrechnungsunterlagen bewahren wir aufgrund handels- und steuerrechtlicher Pflichten bis zu zehn Jahre auf (§ 257 HGB, § 147 AO) und löschen sie danach. Kontodaten löschen wir, wenn Sie das Konto löschen lassen, soweit keine Aufbewahrungspflicht entgegensteht.",
          ],
        },
        {
          id: "rights",
          title: "12. Ihre Rechte",
          paragraphs: [
            `Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20) sowie das Recht, eine Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen (Art. 7 Abs. 3). Eine Nachricht an ${c.email} genügt.`,
            "Widerspruchsrecht (Art. 21 DSGVO): Soweit wir Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO verarbeiten, können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen.",
            `Beschwerderecht (Art. 77 DSGVO): Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren. Für uns zuständig ist ${SUPERVISOR}.`,
          ],
        },
        {
          id: "misc",
          title: "13. Sonstiges",
          paragraphs: [
            "Eine automatisierte Entscheidungsfindung einschließlich Profiling (Art. 22 DSGVO) findet nicht statt.",
            "Wir passen diese Datenschutzerklärung an, wenn sich unsere Website oder die Rechtslage ändert; es gilt die hier veröffentlichte Fassung.",
          ],
        },
      ],
    },

    uk: {
      title: "Політика конфіденційності",
      intro: "Як ми обробляємо ваші персональні дані — інформація згідно зі ст. 13 і 14 Загального регламенту ЄС про захист даних (GDPR / DSGVO). Станом на листопад 2026 р.",
      note: "Юридично обовʼязковою є німецька версія (Datenschutzerklärung).",
      sections: [
        {
          id: "controller",
          title: "1. Хто відповідає за ваші дані",
          paragraphs: [
            `Відповідальна за обробку даних на kaufmann-reisen.de — компанія ${C.name}, ${ADDRESS}, Німеччина, в особі директорів ${MANAGERS}.`,
            `Контакти: ${contact}. З питань захисту даних і для здійснення своїх прав достатньо написати нам у довільній формі.`,
          ],
        },
        {
          id: "hosting",
          title: "2. Хостинг і журнали сервера",
          paragraphs: [
            `Сайт працює на сервері компанії ${HETZNER}, у дата-центрі у Фалькенштайні (Німеччина). Hetzner обробляє дані за нашим дорученням (ст. 28 GDPR).`,
            "Під час кожного відкриття сторінки вебсервер автоматично записує: IP-адресу, дату й час, адресу сторінки, код відповіді, обсяг переданих даних, попередню сторінку (referrer) і дані браузера (user-agent). Ці дані потрібні, щоб сайт працював безпечно й без збоїв і щоб помічати атаки (ст. 6 ч. 1 п. f GDPR). Журнали автоматично видаляються через 14 днів.",
            "Усі зʼєднання з сайтом зашифровані (TLS, https).",
          ],
        },
        {
          id: "cookies",
          title: "3. Файли cookie",
          paragraphs: [
            "Ми використовуємо лише cookie, без яких сайт не працює (§ 25 ч. 2 п. 2 TDDDG); для них згода не потрібна. Аналітичних, рекламних чи відстежувальних cookie немає, сторонніх сервісів, що стежать за відвідуванням, ми не підключаємо.",
            "kaufmann_session — тримає вас у кабінеті після входу; видаляється при виході, не пізніше ніж через 7 днів.",
            "kaufmann_visitor — привʼязує до вашого браузера місця, тимчасово зайняті під час вибору; строк — 7 днів.",
            "kaufmann_lang — зберігає обрану мову; строк — 1 рік.",
          ],
        },
        {
          id: "account",
          title: "4. Особистий кабінет",
          paragraphs: [
            "Для бронювань і доступу до квитків створюється кабінет — під час реєстрації або першого бронювання. Ми зберігаємо e-mail і пароль (лише у вигляді зашифрованого хешу), а також імʼя для показу й фото профілю, якщо ви їх вкажете.",
            "Підстава — виконання договору та дії перед його укладенням (ст. 6 ч. 1 п. b GDPR). Кабінет можна видалити будь-коли; документи бронювань, які ми зобовʼязані зберігати, зберігаються до кінця строків, установлених законом (розділ 11).",
          ],
        },
        {
          id: "booking",
          title: "5. Бронювання квитків",
          paragraphs: [
            "Для бронювання ми обробляємо дані кожного пасажира: імʼя та прізвище (латиницею, як у паспорті), телефон, e-mail, категорію пасажира або дату народження (для знижок), за потреби номер картки клієнта, а також маршрут, дату, місце, ціну й статус оплати.",
            "Ці дані потрібні, щоб оформити квиток, забронювати місце у перевізника, повідомляти про зміни рейсу й повертати кошти (ст. 6 ч. 1 п. b GDPR). Без них бронювання неможливе.",
            "Зараз оплата відбувається при посадці в автобус або в наших агентів; онлайн-оплати поки немає.",
            "Наші працівники й агенти бачать лише ті бронювання, які потрібні їм для роботи, наприклад квитки, які вони продали.",
          ],
        },
        {
          id: "carrier",
          title: "6. Передача даних перевізнику (Grandes Tour)",
          paragraphs: [
            "Рейси виконує автобусний перевізник Grandes Tour (grandes-tour.com.ua). Щоб місце в автобусі було заброньоване й вас упізнали під час посадки, ми передаємо Grandes Tour: імʼя та прізвище, телефон, маршрут, дату, місце, категорію пасажира й за потреби номер картки клієнта. Grandes Tour обробляє ці дані як самостійний відповідальний (ст. 6 ч. 1 п. b GDPR).",
            "Рейси сполучають ЄС з Україною, і Grandes Tour працює також в Україні. Тому дані можуть передаватися в Україну, щодо якої немає рішення Єврокомісії про належний рівень захисту. Передача потрібна для виконання договору перевезення (ст. 49 ч. 1 п. b GDPR).",
          ],
        },
        {
          id: "email",
          title: "7. Листи",
          paragraphs: [
            `Квитки, підтвердження, повідомлення про рейс і посилання для відновлення пароля ми надсилаємо через сервіс ${RESEND}, який діє за нашим дорученням (ст. 28 GDPR). Обробляються ваш e-mail, зміст листа й технічні дані доставки. Resend зберігає дані в США; компанія сертифікована за EU-US Data Privacy Framework (рішення про належний захист, ст. 45 GDPR), додатково діють стандартні договірні умови ЄС.`,
            `Нашу поштову скриньку обслуговує ${IONOS}, Німеччина. Рекламних листів і розсилок ми не надсилаємо.`,
          ],
        },
        {
          id: "contact",
          title: "8. Звернення до нас",
          paragraphs: [
            "Коли ви пишете нам на e-mail, телефонуєте чи пишете в месенджер, ми обробляємо ваші дані, щоб відповісти: щодо бронювання — за ст. 6 ч. 1 п. b GDPR, в інших випадках — за ст. 6 ч. 1 п. f GDPR.",
            "Якщо ви користуєтеся WhatsApp, Viber чи Telegram, діють також правила конфіденційності цих сервісів; вони можуть обробляти дані й за межами ЄС. Якщо ви цього не хочете, напишіть нам на e-mail або зателефонуйте.",
          ],
        },
        {
          id: "security",
          title: "9. Безпека і захист від зловживань",
          paragraphs: [
            "Щоб запобігти зловживанням, наприклад автоматичному підбору паролів чи масовим бронюванням, ми рахуємо запити з однієї IP-адреси чи e-mail. Для цього зберігається лише незворотний хеш; він діє не довше години, після чого видаляється (ст. 6 ч. 1 п. f GDPR).",
            "Коли бронювання змінюють, ми записуємо, хто і коли це зробив, разом з IP-адресою й даними браузера, щоб можна було розібратися з помилками чи зловживаннями (ст. 6 ч. 1 п. f GDPR). Цей журнал зберігається разом із бронюванням.",
          ],
        },
        {
          id: "links",
          title: "10. Посилання на Google Maps і Google Wallet",
          paragraphs: [
            `Для зупинок ми даємо посилання на Google Maps, для квитків — на Google Wallet. Лише коли ви натиснете таке посилання, ${GOOGLE}, обробляє ваші дані за своїми правилами. Під час звичайного перегляду наших сторінок зʼєднання з Google не встановлюється.`,
          ],
        },
        {
          id: "storage",
          title: "11. Строки зберігання",
          paragraphs: [
            "Ми зберігаємо персональні дані лише стільки, скільки потрібно для зазначених цілей. Документи бронювань і розрахунків зберігаємо до десяти років через вимоги торгового й податкового права Німеччини (§ 257 HGB, § 147 AO), після чого видаляємо. Дані кабінету видаляємо, коли ви просите видалити кабінет, якщо закон не вимагає їх зберігати.",
          ],
        },
        {
          id: "rights",
          title: "12. Ваші права",
          paragraphs: [
            `Ви маєте право на доступ до даних (ст. 15 GDPR), виправлення (ст. 16), видалення (ст. 17), обмеження обробки (ст. 18) і перенесення даних (ст. 20), а також право будь-коли відкликати згоду на майбутнє (ст. 7 ч. 3). Достатньо написати на ${c.email}.`,
            "Право на заперечення (ст. 21 GDPR): якщо ми обробляємо дані на підставі ст. 6 ч. 1 п. f GDPR, ви можете будь-коли заперечити з причин, повʼязаних з вашою особливою ситуацією.",
            `Право на скаргу (ст. 77 GDPR): ви можете поскаржитися до органу з нагляду за захистом даних. Для нас це ${SUPERVISOR}.`,
          ],
        },
        {
          id: "misc",
          title: "13. Інше",
          paragraphs: [
            "Автоматизованого ухвалення рішень, зокрема профілювання (ст. 22 GDPR), немає.",
            "Ми оновлюємо цю політику, коли змінюється сайт або законодавство; чинна — версія, опублікована тут.",
          ],
        },
      ],
    },

    en: {
      title: "Privacy policy",
      intro: "How we process your personal data — information under Articles 13 and 14 of the EU General Data Protection Regulation (GDPR). Last updated: November 2026.",
      note: "The German version (Datenschutzerklärung) is legally binding.",
      sections: [
        {
          id: "controller",
          title: "1. Controller",
          paragraphs: [
            `The controller for data processing on kaufmann-reisen.de is ${C.name}, ${ADDRESS}, Germany, represented by its managing directors ${MANAGERS}.`,
            `Contact: ${contact}. For questions about data protection and to exercise your rights, an informal message to this address is enough.`,
          ],
        },
        {
          id: "hosting",
          title: "2. Hosting and server logs",
          paragraphs: [
            `The website runs on a server of ${HETZNER}, in its Falkenstein data centre (Germany). Hetzner processes the data on our behalf (Art. 28 GDPR).`,
            "With every page request the web server automatically records: IP address, date and time, requested address, status code, amount of data sent, previous page (referrer) and browser details (user agent). We need these data to run the website securely and reliably and to detect attacks (Art. 6(1)(f) GDPR). The logs are deleted automatically after 14 days.",
            "All connections to the website are encrypted (TLS, https).",
          ],
        },
        {
          id: "cookies",
          title: "3. Cookies",
          paragraphs: [
            "We only use cookies that are strictly necessary for the website to work (§ 25(2) no. 2 TDDDG); no consent is needed for them. We use no analytics, advertising or tracking cookies and embed no third-party services that track your visit.",
            "kaufmann_session — keeps you signed in; deleted when you sign out, at the latest after 7 days.",
            "kaufmann_visitor — links the seats held while you choose to your browser; expires after 7 days.",
            "kaufmann_lang — remembers your language; expires after 1 year.",
          ],
        },
        {
          id: "account",
          title: "4. Customer account",
          paragraphs: [
            "An account is created for bookings and access to your tickets — when you register or with your first booking. We store your e-mail address and your password (only as an encrypted hash) and, if you provide them, a display name and profile picture.",
            "The legal basis is the performance of the contract and pre-contractual steps (Art. 6(1)(b) GDPR). You can have your account deleted at any time; booking records we are required to keep are stored until the legal retention periods end (section 11).",
          ],
        },
        {
          id: "booking",
          title: "5. Booking tickets",
          paragraphs: [
            "For a booking we process for each passenger: first and last name (in Latin letters as in the passport), phone number, e-mail address, passenger category or date of birth (for discounts), a customer card number where applicable, and the route, date, seat, price and payment status.",
            "We need these data to issue the ticket, reserve the seat with the bus company, inform you about changes to your trip and process refunds (Art. 6(1)(b) GDPR). A booking is not possible without them.",
            "Payment currently takes place when boarding the bus or with our agents; we do not offer online payment at present.",
            "Our staff and agents only see the bookings they need for their work, for example the tickets they sold.",
          ],
        },
        {
          id: "carrier",
          title: "6. Transfer to the bus company (Grandes Tour)",
          paragraphs: [
            "The trips are operated by the bus company Grandes Tour (grandes-tour.com.ua). So that your seat is reserved and you are recognised when boarding, we send Grandes Tour: first and last name, phone number, route, date, seat, passenger category and, where applicable, the customer card number. Grandes Tour processes these data as an independent controller (Art. 6(1)(b) GDPR).",
            "The trips connect the EU with Ukraine, and Grandes Tour also operates in Ukraine. Data may therefore be transferred to Ukraine, for which there is no adequacy decision of the European Commission. The transfer is necessary for the performance of the contract of carriage (Art. 49(1)(b) GDPR).",
          ],
        },
        {
          id: "email",
          title: "7. E-mails",
          paragraphs: [
            `We send tickets, booking confirmations, trip notices and password-reset links through ${RESEND}, acting on our behalf (Art. 28 GDPR). Your e-mail address, the content of the message and technical delivery data are processed. Resend stores data in the USA; it is certified under the EU-US Data Privacy Framework (adequacy decision, Art. 45 GDPR), and the EU Standard Contractual Clauses apply in addition.`,
            `Our mailbox is operated by ${IONOS}, Germany. We do not send advertising e-mails or newsletters.`,
          ],
        },
        {
          id: "contact",
          title: "8. Contacting us",
          paragraphs: [
            "When you contact us by e-mail, phone or messenger, we process your details to answer your request — for questions about a booking under Art. 6(1)(b) GDPR, otherwise under Art. 6(1)(f) GDPR.",
            "If you use WhatsApp, Viber or Telegram, the privacy terms of that provider also apply; these services may process data outside the EU. If you do not want this, please e-mail or call us.",
          ],
        },
        {
          id: "security",
          title: "9. Security and abuse prevention",
          paragraphs: [
            "To prevent abuse, such as automated password guessing or mass bookings, we count requests per IP address or e-mail address. For this we only store an irreversible hash value; it stops having any effect after at most one hour and is then deleted (Art. 6(1)(f) GDPR).",
            "When a booking is changed, we log who changed it and when, including IP address and browser details, so that errors and abuse can be traced (Art. 6(1)(f) GDPR). The log is kept together with the booking.",
          ],
        },
        {
          id: "links",
          title: "10. Links to Google Maps and Google Wallet",
          paragraphs: [
            `We link stops to Google Maps and tickets to Google Wallet. Only when you click such a link does ${GOOGLE} (Ireland), process your data under its own terms. Merely visiting our pages does not connect you to Google.`,
          ],
        },
        {
          id: "storage",
          title: "11. Retention",
          paragraphs: [
            "We keep personal data only as long as necessary for the purposes described. Booking and accounting records are kept for up to ten years because of German commercial and tax law (§ 257 HGB, § 147 AO) and deleted afterwards. Account data are deleted when you have your account deleted, unless we are legally required to keep them.",
          ],
        },
        {
          id: "rights",
          title: "12. Your rights",
          paragraphs: [
            `You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20), and the right to withdraw consent at any time with effect for the future (Art. 7(3)). A message to ${c.email} is enough.`,
            "Right to object (Art. 21 GDPR): where we process data on the basis of Art. 6(1)(f) GDPR, you may object at any time on grounds relating to your particular situation.",
            `Right to lodge a complaint (Art. 77 GDPR): you may complain to a data protection supervisory authority. The authority responsible for us is ${SUPERVISOR}.`,
          ],
        },
        {
          id: "misc",
          title: "13. Other",
          paragraphs: [
            "There is no automated decision-making, including profiling (Art. 22 GDPR).",
            "We update this policy when our website or the law changes; the version published here applies.",
          ],
        },
      ],
    },

    es: {
      title: "Política de privacidad",
      intro: "Cómo tratamos sus datos personales: información conforme a los artículos 13 y 14 del Reglamento General de Protección de Datos (RGPD). Actualizada: noviembre de 2026.",
      note: "La versión alemana (Datenschutzerklärung) es la jurídicamente vinculante.",
      sections: [
        {
          id: "controller",
          title: "1. Responsable",
          paragraphs: [
            `El responsable del tratamiento de datos en kaufmann-reisen.de es ${C.name}, ${ADDRESS}, Alemania, representada por sus administradores ${MANAGERS}.`,
            `Contacto: ${contact}. Para consultas sobre protección de datos y para ejercer sus derechos basta un mensaje sin formalidades a esta dirección.`,
          ],
        },
        {
          id: "hosting",
          title: "2. Alojamiento y registros del servidor",
          paragraphs: [
            `El sitio funciona en un servidor de ${HETZNER}, en su centro de datos de Falkenstein (Alemania). Hetzner trata los datos por encargo nuestro (art. 28 RGPD).`,
            "Con cada visita, el servidor web registra automáticamente: dirección IP, fecha y hora, dirección solicitada, código de estado, volumen de datos transferido, página anterior (referrer) y datos del navegador (user agent). Necesitamos estos datos para que el sitio funcione de forma segura y sin fallos y para detectar ataques (art. 6.1.f RGPD). Los registros se borran automáticamente a los 14 días.",
            "Todas las conexiones con el sitio están cifradas (TLS, https).",
          ],
        },
        {
          id: "cookies",
          title: "3. Cookies",
          paragraphs: [
            "Solo usamos cookies estrictamente necesarias para el funcionamiento del sitio (§ 25.2.2 TDDDG), que no requieren consentimiento. No usamos cookies de análisis, publicidad ni seguimiento, ni integramos servicios de terceros que rastreen su visita.",
            "kaufmann_session: mantiene su sesión iniciada; se borra al cerrar sesión y, como máximo, a los 7 días.",
            "kaufmann_visitor: asocia a su navegador los asientos reservados provisionalmente mientras elige; caduca a los 7 días.",
            "kaufmann_lang: guarda el idioma elegido; caduca al año.",
          ],
        },
        {
          id: "account",
          title: "4. Cuenta de cliente",
          paragraphs: [
            "Para reservar y acceder a sus billetes se crea una cuenta, al registrarse o con la primera reserva. Guardamos su correo electrónico y su contraseña (solo como hash cifrado) y, si los indica, un nombre visible y una foto de perfil.",
            "La base jurídica es la ejecución del contrato y de medidas precontractuales (art. 6.1.b RGPD). Puede pedir que borremos su cuenta en cualquier momento; los documentos de reservas que estamos obligados a conservar se guardan hasta que vencen los plazos legales (apartado 11).",
          ],
        },
        {
          id: "booking",
          title: "5. Reserva de billetes",
          paragraphs: [
            "Para una reserva tratamos de cada pasajero: nombre y apellidos (en alfabeto latino, como en el pasaporte), teléfono, correo electrónico, categoría de pasajero o fecha de nacimiento (para descuentos), en su caso el número de tarjeta de cliente, así como ruta, fecha, asiento, precio y estado del pago.",
            "Necesitamos estos datos para emitir el billete, reservar el asiento con la empresa de autobuses, informarle de cambios en su viaje y tramitar reembolsos (art. 6.1.b RGPD). Sin ellos no es posible reservar.",
            "Actualmente el pago se realiza al subir al autobús o con nuestros agentes; por ahora no ofrecemos pago en línea.",
            "Nuestro personal y nuestros agentes solo ven las reservas que necesitan para su trabajo, por ejemplo los billetes que han vendido.",
          ],
        },
        {
          id: "carrier",
          title: "6. Comunicación a la empresa de autobuses (Grandes Tour)",
          paragraphs: [
            "Los viajes los realiza la empresa de autobuses Grandes Tour (grandes-tour.com.ua). Para que su asiento quede reservado y le reconozcan al subir, comunicamos a Grandes Tour: nombre y apellidos, teléfono, ruta, fecha, asiento, categoría de pasajero y, en su caso, el número de tarjeta de cliente. Grandes Tour trata estos datos como responsable independiente (art. 6.1.b RGPD).",
            "Los viajes conectan la UE con Ucrania, y Grandes Tour también opera en Ucrania. Por ello los datos pueden transferirse a Ucrania, país sin decisión de adecuación de la Comisión Europea. La transferencia es necesaria para ejecutar el contrato de transporte (art. 49.1.b RGPD).",
          ],
        },
        {
          id: "email",
          title: "7. Correos electrónicos",
          paragraphs: [
            `Enviamos billetes, confirmaciones de reserva, avisos sobre el viaje y enlaces para restablecer la contraseña mediante ${RESEND}, que actúa por encargo nuestro (art. 28 RGPD). Se tratan su dirección de correo, el contenido del mensaje y datos técnicos de entrega. Resend guarda los datos en EE. UU.; está certificada conforme al Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación, art. 45 RGPD) y además se aplican las cláusulas contractuales tipo de la UE.`,
            `Nuestro buzón de correo lo gestiona ${IONOS}, Alemania. No enviamos correos publicitarios ni boletines.`,
          ],
        },
        {
          id: "contact",
          title: "8. Contacto",
          paragraphs: [
            "Si nos contacta por correo, teléfono o mensajería, tratamos sus datos para responder: en consultas sobre una reserva según el art. 6.1.b RGPD y, en los demás casos, según el art. 6.1.f RGPD.",
            "Si usa WhatsApp, Viber o Telegram, se aplican además las condiciones de privacidad de ese proveedor, que puede tratar datos fuera de la UE. Si no lo desea, escríbanos un correo o llámenos.",
          ],
        },
        {
          id: "security",
          title: "9. Seguridad y prevención de abusos",
          paragraphs: [
            "Para evitar abusos, como probar contraseñas de forma automática o hacer reservas masivas, contamos las solicitudes por dirección IP o de correo. Para ello solo guardamos un valor hash irreversible, que deja de tener efecto como máximo a la hora y después se borra (art. 6.1.f RGPD).",
            "Cuando se modifica una reserva, registramos quién lo hizo y cuándo, con la dirección IP y los datos del navegador, para poder aclarar errores y abusos (art. 6.1.f RGPD). El registro se conserva junto con la reserva.",
          ],
        },
        {
          id: "links",
          title: "10. Enlaces a Google Maps y Google Wallet",
          paragraphs: [
            `Enlazamos las paradas con Google Maps y los billetes con Google Wallet. Solo cuando pulsa uno de estos enlaces, ${GOOGLE}, trata sus datos según sus propias condiciones. La simple visita a nuestras páginas no establece ninguna conexión con Google.`,
          ],
        },
        {
          id: "storage",
          title: "11. Plazo de conservación",
          paragraphs: [
            "Conservamos los datos personales solo el tiempo necesario para los fines indicados. Los documentos de reservas y facturación se conservan hasta diez años por obligaciones mercantiles y fiscales alemanas (§ 257 HGB, § 147 AO) y después se borran. Los datos de la cuenta se borran cuando usted pide borrar la cuenta, salvo obligación legal de conservarlos.",
          ],
        },
        {
          id: "rights",
          title: "12. Sus derechos",
          paragraphs: [
            `Tiene derecho de acceso (art. 15 RGPD), rectificación (art. 16), supresión (art. 17), limitación del tratamiento (art. 18) y portabilidad (art. 20), así como a retirar su consentimiento en cualquier momento con efectos para el futuro (art. 7.3). Basta un mensaje a ${c.email}.`,
            "Derecho de oposición (art. 21 RGPD): cuando tratamos datos en base al art. 6.1.f RGPD, puede oponerse en cualquier momento por motivos relacionados con su situación particular.",
            `Derecho a reclamar (art. 77 RGPD): puede presentar una reclamación ante una autoridad de control de protección de datos. La competente para nosotros es ${SUPERVISOR}.`,
          ],
        },
        {
          id: "misc",
          title: "13. Otros",
          paragraphs: [
            "No se toman decisiones automatizadas ni se elaboran perfiles (art. 22 RGPD).",
            "Actualizamos esta política cuando cambian nuestro sitio o la legislación; se aplica la versión publicada aquí.",
          ],
        },
      ],
    },
  };
  return docs[lang];
}
