# Kaufmann Reisen: як працювати з проєктом

Сайт продажу автобусних квитків **https://kaufmann-reisen.de**: бренд Kaufmann Reisen, колишній «Asol BUS».
Він продає квитки на рейси **Grandes Tour** через їхній API (і власні рейси, якщо вони з'являться в БД).
Мова спілкування з власником — українська.

> Репозиторій **публічний**. Сюди не пишемо паролі, ключі, логіни сервера й акаунтів.
> Повна робоча інструкція (сервер, доступи, деплой) лежить у приватному проєкті claude.ai
> «Штат Агентів І Дашборт», документ `claude/kaufmann-reisen-instrukciya.md`.

Детальніше про архітектуру — `README.md`, про розділи сайту — `docs/STRUCTURE.md`.

## Правила власника (обов'язково)

1. **grandes-tour.com.ua не змінювати.** Його можна лише брати за зразок і користуватися ним через API.
2. **Секрети не вводити і не показувати** (API-ключі, паролі). Їх вписує сам власник у файл оточення на сервері.
3. **Тестові бронювання в Grandes Tour — тільки з дозволу власника.** Це реальні квитки й місця в автобусі.
4. **Онлайн-оплата — останній етап.** Зараз працює лише «оплата при посадці».
5. **Тексти — у 4 мовах:** `uk` (основна), `de`, `es`, `en`. Нові ключі додаємо в усі чотири файли `lib/i18n/dict/*.ts`.
   Тип словника береться з `uk.ts`, тож пропущений ключ дасть помилку TypeScript.
6. **Зміни точкові:** мінімум коду, без «покращень» поруч. На логіку пишемо тест (Vitest).
   Перед деплоєм `npm test` має бути зеленим (його запускає й Docker-збірка).

## Карта коду

| Що | Де |
|---|---|
| Сторінки (головна, результати, рейс, оформлення, квиток, кабінет) | `app/` (`page.tsx`, `results/`, `trip/`, `booking/`, `tickets/`, `cabinet/`) |
| Інфосторінки: багаж, правила, повернення | `app/baggage`, `app/rules`, `app/refund` (тексти в `dict.legal.*`) |
| Impressum і політика конфіденційності (DDG, DSGVO; німецький текст обовʼязковий) | `app/impressum`, `app/datenschutz`, тексти в `lib/legal/texts.ts`, реквізити компанії в `lib/legal/company.ts` (вони ж у підписі кожного листа) |
| Пошук (форма, міста будь-якою мовою, календар з цінами) | `components/home/SearchPanel.tsx`, `CityInput.tsx`, `DatePicker.tsx` |
| Ціни на дні для календаря | `app/api/calendar/route.ts` |
| Крок «Місця» (схема салону; скільки місць обрано — стільки пасажирів) | `components/checkout/SeatStep.tsx`, `SeatMapView.tsx` |
| Оформлення (тип квитка, латиниця, телефон, картка клієнта, багаж) | `components/checkout/CheckoutForm.tsx`, `app/booking/page.tsx` |
| Створення бронювання (сервер) | `app/api/booking/route.ts` |
| Перевізники | `lib/carriers/registry.ts`, `types.ts`; власні рейси — `asol/` (id `kaufmann`) |
| **Grandes Tour** | `lib/carriers/grandes-tour/client.ts` (HTTP + вхід агента), `index.ts` (пошук, схема, бронювання), `pricing.ts` (типи пасажирів, ціни, картки, скасування) |
| Синхронне скасування в GT | `lib/tickets/carrierSync.ts` (викликається з `lib/tickets/service.ts` і `lib/payments.ts`) |
| Міста й переклади назв | `lib/trips/cities.ts` + знімок довідника GT `lib/trips/gtCities.ts` (оновлення: `scripts/gt-cities.mjs`) |
| Багаж за напрямком (ES 2 €/кг, DE 1 €/кг) | `lib/trips/baggage.ts` |
| Правила імені й телефону (як у GT) | `lib/passengerName.ts`, `lib/phone.ts` |
| Контакти за замовчуванням (справжні — в БД `SiteSetting contact.*`, редагуються в адмінці) | `lib/siteContacts.ts` |
| Номери квитків `KR-12345` (старі `AB-…` теж читаються) | `lib/tickets/reference.ts` |
| Схема БД (Prisma, SQLite) | `prisma/schema.prisma` (`Ticket.carrierRef` = квиток у GT) |

## Grandes Tour API

- База: `https://grandes-tour.com.ua`, опис: `/swagger/v3/swagger.json`. Заголовки: `Api-Key` (env `GRANDES_TOUR_API_KEY`), `Accept-Language: uk`.
- **Читання** (міста, пошук, схема салону, типи пасажирів, ціни) працює з одним ключем.
  **Бронювання, скасування й картки клієнта** вимагають входу акаунта агента: `POST /api/v2/auth/signin` і далі `Authorization: Bearer`.
  Дані входу беруться з env `GRANDES_TOUR_EMAIL` / `GRANDES_TOUR_PASSWORD`. `client.ts` входить сам, коли отримує відповідь 401.
- Які виклики використовуємо:

  | Виклик | Для чого |
  |---|---|
  | `GET /api/v3/cache/cities` | міста, `country_iso` |
  | `POST /api/v2/booking/search_trips` | рейси: лише прямі, з `canBook && canBookWithPaymentAtBoarding` |
  | `GET /api/v3/booking/get_bus_map_for_trip_id` | схема салону |
  | `POST /api/v2/references/passenger_types_by_trip_id` | типи квитків |
  | `POST /api/v2/booking/passenger_ticket_price` | ціна квитка |
  | `POST /api/v2/booking/get_discount_card_info` | картка клієнта |
  | `POST /api/v2/booking/reserve_tickets` | бронювання |
  | `POST /api/v2/booking/cancel_ticket` | скасування |
- **Ідентифікатори:**
  - id рейсу в нас: `gt-<tripId>-<cityFromId>-<cityToId>`;
  - номер замовлення: `GT-<orderId>`;
  - квиток, у `Ticket.carrierRef`: `GT:<orderId>:<ticketId>`.
- **reserve_tickets** відправляємо так само, як сайт GT:
  - імена ВЕЛИКИМИ латинськими літерами;
  - телефон у форматі E.164 (`+380…`);
  - у `trip_seats_to` / `trip_seats_back`: `trip_id`, `seat_id` (id місця зі схеми, а не його номер), `city_from_id`, `city_to_id`, `number` (порядковий номер рейсу з результату пошуку), `busId`, `passenger_type_id`, `discount_cart`;
  - `hours_to_auto_cancel_reserved_status`: `0` для «оплата при посадці» (бронь не скасовується сама, як у агентів на сайті GT), `24` для онлайн-оплати; без нього GT тримає бронь лише ~3 год;
  - ціни не передаємо, їх рахує GT.
- **Помилки, які GT повертає:**
  - «Номер повинно бути від 1 до 100»: не передано `number`;
  - «Неправильний формат номера телефону»: номер не E.164 або неіснуючий;
  - 401: немає входу агента.
- **Схема салону:**
  - `x` — ряд від водія; `y` — місце поперек ряду: 1–2 ліворуч, 3 — прохід, 4–5 праворуч; `floor` — поверх;
  - статуси: `free`, `purchased`, `reserved`, `hidden`;
  - `hidden` — це місця іншого рейсу того самого автобуса (спільний автобус Мадрид/Севілья: ліва сторона — Мадрид, права — Севілья). Показуємо їх як недоступні.
- **QR на квитку** для квитків GT містить лише номер квитка GT (`1014651`), як у їхньому квитку / Apple Wallet, щоб водії GT сканували однаково. Для власних рейсів — посилання `/check/KR-…`. `/check` і сканер у кабінеті приймають обидва варіанти.
- **Імена** — лише латиниця: `^[a-zA-Z][a-zA-Z -]+[a-zA-Z]$`, щонайменше 3 символи (правило сайту GT).
- **Типи квитків** приходять від GT: Дорослий, Молодь 12–24, Від 60, УБД, Дитина 4–12, Дитина до 4. Сайт визначає тип за назвою.

## Деплой (коротко)

Код на сервер потрапляє копією з робочої папки (rsync), а не з git. Далі на сервері `docker compose build` (це `npm ci` → `npm test` → `next build`) і `docker compose up -d`.
Збірка триває ≈ 5–6 хв. Поки нова збирається, працює стара версія.
Під час старту контейнер виконує `prisma db push`: зміни схеми мають бути лише додаванням полів чи таблиць.
Команди, шляхи й доступи описані в приватній інструкції (див. вище).

## Що ще не зроблено

- Онлайн-оплата (останній етап).
- Перемикач валют: зараз усе в EUR.
- Postgres замість SQLite і регулярні бекапи БД.
