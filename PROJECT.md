# Food Service / Kitch POS

Multi-brand витрина доставки еды, админка и POS в одном Next.js приложении.

## Бренды

- `kitch-pizza` (домен `kitch.md`)
- `losos` (домен `losos.md`, путь `/losos` на localhost)
- `the-spot` (домен `thespot.md`, путь `/thespot` на localhost; в URL — `thespot` без дефиса, канон в конфиге — `the-spot`)

Канонический конфиг: `src/brands/index.ts` (`BrandConfig`, экспорт `brands` + алиас `BRANDS`). У каждого бренда: `domain`, `logo`, **`smsSender`** (имя отправителя SMS.md: `LOSOS` / `TheSpot` / `Kitch!`). Нормализация slug — `normalizePosBrandSlug` + `getBrandBySlug`; резолв по Host — `getBrandByHost`.

## Стек

| Область | Используется |
|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind v4, shadcn/ui, Radix UI |
| Data | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Maps | Leaflet, Leaflet Draw, react-leaflet, Nominatim |
| POS Auth | Supabase Auth + `jose` JWT + `bcryptjs` PIN |
| POS печать (Android) | RawBT intent (`ru.a402d.rawbtprinter`); предчек — `html-to-image` → PNG inline |
| UI extras | Sonner, Vaul, Swiper, cmdk, recharts, DiceBear (`@dicebear/core`, `@dicebear/thumbs`) |

ESLint: `next/core-web-vitals`, `next/typescript`; `@typescript-eslint/no-explicit-any: warn`.

## Структура

```
src/
├── app/
│   ├── (client)/        # витрина, checkout, account, payment/success|fail (MAIB redirect)
│   ├── feedback/[token]/  # публичная форма отзыва по UUID-токену (прямая ссылка)
│   ├── f/[code]/          # короткая ссылка из SMS → та же форма (lookup по short_code)
│   ├── (admin)/admin/   # админка (+ /admin/feedback)
│   ├── pos/             # POS + KDS (страницы App Router)
│   ├── api/             # REST (+ checkout/*, maib/callback, feedback/[token] + upload/photo, cron/feedback-sms, admin/feedback/…/resolve)
│   ├── robots.ts, sitemap.ts
│   ├── globals.css
│   └── layout.tsx       # root, <html lang="ro">
├── brands/              # BrandConfig + host→brand
├── components/
│   ├── client/          # витрина, корзина (CartRoot/Sheet/Panel, CartItemCard), checkout, auth, welcome-bonus-modal, storefront-campaign-rules-context
│   ├── admin/           # AdminShell, sidebar, finances/, analytics, inventory, customers/, feedback/, cash-sessions/
│   ├── feedback/        # FeedbackForm (публичная форма отзыва, client)
│   ├── pos/             # PosAppShell, OrderForm, KdsScreen, discount-breakdown; order-form/pos-address-cards.tsx
│   ├── ReceiptTemplate.tsx  # offscreen-шаблон термочека 576px (RawBT)
│   ├── store-closed-modal.tsx  # оверлей «магазин закрыт» (витрина)
│   ├── topping-stepper-card.tsx  # карточка топпинга со stepper (витрина + POS)
│   ├── seo/JsonLd.tsx
│   ├── MetaPixel.tsx
│   └── ui/              # shadcn
├── hooks/
│   ├── use-store-open.ts       # часы работы витрины по BrandConfig (Europe/Chisinau)
│   ├── use-persist-store-hydration.ts  # ожидание zustand persist (checkout и др.)
│   └── use-checkout-pricing.ts # debounced POST /api/[brandSlug]/checkout/pricing
├── lib/
│   ├── actions/         # server actions (см. раздел Server Actions)
│   ├── data/            # storefront fetchers
│   ├── store/           # Zustand stores (cart, delivery, store-closed, …)
│   ├── i18n/, pos/, pbx/, seo/, telegram/, supabase/
│   ├── admin/           # get-actual-balance, orders-today-metrics; inventory/invoice-ocr-types.ts
│   ├── actions/admin/customers-list.ts, analytics.ts, feedback.ts, delivery-zone-schedules.ts
│   ├── bonus.ts, customers.ts, discount.ts, discount-engine.ts, pricing.ts, storefront-item-campaign-discount.ts, resolve-brand-id.ts
│   ├── maib/            # token.ts, signature.ts, client.ts — MAIB Merchants API (онлайн-оплата)
│   ├── feedback.ts      # isNegativeFeedback, short URL/SMS, generateFeedbackShortCode
│   ├── feedback-telegram.ts  # sendNegativeFeedbackTelegram (негативные отзывы → Telegram)
│   ├── sms.ts           # sendSms({ to, text, brandSlug? }) — единая отправка SMS.md
│   ├── receipt-pricing-breakdown.ts  # breakdown для термочека (subtotal / item / promo / бонусы)
│   ├── rawbt.ts, receipt-print.ts  # Android RawBT: текст, ящик, предчек PNG
│   ├── store-hours.ts, cart-toppings.ts, cart-helpers.ts, topping-pricing.ts, topping-max-selection.ts, topping-recipe-match.ts
│   ├── pos-cart-toppings.ts, pos-cart-helpers.ts
│   ├── delivery-zone-schedule.ts  # слоты расписания зоны (Europe/Chisinau)
│   ├── inventory-units.ts, recipe-*.ts
│   ├── product-recipe-cost.ts, semi-finished-cost.ts, ingredient-avg-cost.ts
│   ├── order-recipe-stock-deduction.ts
│   └── ...
├── types/               # database, cart, pos, promotions, customers
├── scripts/
│   ├── setup-telegram-webhook.ts
│   └── send-campaign.ts       # one-off SMS-кампания + начисление бонусов (tsx + dotenv)
└── middleware.ts

.github/workflows/feedback-sms-cron.yml   # */10 → GET /api/cron/feedback-sms
```

Корень репозитория: `vercel.json` (только 301 `/ru`, `/ro` → `/`), `.github/workflows/`, `supabase/migrations/`.

## Контракты

### Money & единицы

- **Заказы в БД — integer bani** (`orders.total`, `price`, `discount`, `delivery_fee`, все `*_bani`). В UI — MDL.
- **Исключение — `orders.bonuses_redeemed`:** хранится в **пунктах лояльности (MDL)**, не в bani (1 п. = 1 MDL = 100 bani при расчёте итога).
- **Агрегаторные цены (Glovo):** колонки `aggregator_price_bani` (nullable integer bani) на `menu_items`, `menu_item_variants`, `toppings`. В админке ввод в MDL (÷100); `NULL` = использовать обычную `price`. В POS при `delivery_mode='aggregator'` в корзину и `order_items` пишутся агрегаторные цены (если заданы), иначе fallback на каталожную цену.
- **Склад в БД — numeric MDL** (`ingredient_stock.avg_cost`, цены в `supply_order_items`). Не bani.
- **Склад: единица хранения в БД — g / ml / pcs**. В UI админки — кг / л / шт; цены — MDL за кг/л/шт. Конвертация: `src/lib/inventory-units.ts` (`toDisplayQty`/`toStorageQty`, `toDisplayPrice`/`toStoragePrice`).
- **Исключение:** редактор техкарт (`RecipeEditorModal`), `semi-finished-dialog`, состав топпинга (`RecipeIngredientSemiCompositionTable`) — работают напрямую в г/мл/шт, без конвертации.
- 1 бонус. пункт = 1 MDL = 100 bani при вычете из `total`.

### Order — каноничные значения

`OrderStatus` (src/types/database.ts): `draft` · `new` · `confirmed` · `cooking` · `ready` · `delivery` · `done` · `cancelled` · `rejected`.

`delivery_mode`: `delivery` · `pickup` · `aggregator`.

`payment_method`: `cash` · `card` (наличные у курьера / **оплата картой курьеру** — терминал, без редиректа) · `aggregator_card` · `mixed` · **`online_card`** (только витрина → MAIB hosted checkout / Apple Pay / Google Pay).

`source`: `website` · `pos`.

`aggregator`: пока только `glovo` (для `delivery_mode='aggregator'`).

### Поля orders (избранное)

| Поле | Назначение |
|---|---|
| `status`, `delivery_mode`, `payment_method`, `source` | см. выше |
| `total`, `subtotal`, `item_discount`, `promo_discount`, `discount`, `delivery_fee`, `cash_amount`, `card_amount`, `change_from` | суммы в bani; **`discount = item_discount + promo_discount`** (без бонусов) |
| `delivery_address`, `address_entrance/floor/apartment/intercom`, `delivery_lat/lng` | доставка |
| `courier_id`, `courier_assigned_at`, `delivered_at` | курьер |
| `courier_tg_chat_id`, `courier_tg_message_id`, `courier_tg_message_updated_at` | Telegram-карточка курьера |
| `comment` | общий комментарий (витрина + POS) |
| `kitchen_note` | комментарий повару, **только из POS**; KDS показывает плашкой |
| `scheduled_time` (timestamptz) | предзаказ POS на доставку; сбрасывается при смене на `pickup` |
| `cooking_started_at`, `ready_at`, `paid_at` | KDS-таймеры и касса; **`paid_at`** для `online_card` — webhook MAIB (`OK`) |
| `maib_pay_id` | UUID платежа MAIB после `POST …/checkout/pay` / callback |
| `cash_session_id` | FK кассовой сессии при оплате |
| `aggregator`, `prep_deadline_at` | агрегатор (Glovo) и дедлайн готовки (+15 мин от создания) |
| `profile_id` | FK на `profiles` (витрина или клиент POS) |
| `bonuses_redeemed`, `bonuses_earned` | пункты лояльности (**MDL**, не bani) |
| `bonus_multiplier` (numeric, default 1) | множитель начисления при `done` |
| `promo_code`, `discount_rules_applied` (JSON) | скидки; JSON — массив `{ type, label, amount_bani }` (`item_discount` \| `promo_code` \| `bonus_redemption`) |

**Разбивка скидок (миграция `*_orders_discount_breakdown.sql`):**

| Поле | Назначение |
|---|---|
| `orders.subtotal` | сумма товаров **до** всех скидок, bani |
| `orders.item_discount` | скидка на товары: legacy `menu_items.discount_percent` и/или **`item_percent`** из `discount_rules` (шаг 2b в `calculateOrderPricing`), bani |
| `orders.promo_discount` | скидка промокода / order-level, bani |
| `orders.discount` | **`item_discount + promo_discount`** (суммарная скидка без бонусов) |
| `order_items.original_price` | цена строки **без** скидки на товар, bani (line total) |
| `order_items.item_discount_pct` | `menu_items.discount_percent` или % кампании `item_percent` на момент заказа (из `calculateOrderPricing`) |

`order_items`: `variant_id` (FK `menu_item_variants`, nullable), `size` (текстовый snapshot подписи варианта; старые строки могут иметь `s`/`l`), `toppings` (JSONB: `{ id?, name, price, quantity }[]`, тип `OrderItemTopping`; **`id`** — UUID топпинга в новых заказах, в legacy отсутствует; **`name`** — snapshot на языке клиента RU/RO), `is_gift`, `gift_rule_id`. Поле `price` — **итог строки в bani** (`unit × quantity`); unit включает базу позиции + платные топпинги. Для Glovo unit и `toppings[].price` в JSON берутся из `aggregator_price_bani` каталога (см. `posLinePayloadFromCartItem`). Запись: витрина — `toppingsPayload` в `create-order.ts`; POS — `posToppingsPayloadForDb` в `pos-cart-helpers.ts`.

### Multi-brand: что брендовое, что общее

**Брендовое** (фильтр по `brand_id`, для админки — через `getAdminBrandId()` из cookie `admin-brand-slug`): `menu_categories`, `menu_items`, `menu_item_variants`, `topping_groups`, `toppings`, `menu_item_topping_groups`, `promotions`, `featured_menu_items`, `promo_codes`, `discount_rules`, `delivery_zones`, `orders` (на витрине). На витрине бренд резолвится через `getBrand()` / `getBrandId()`; на админке через cookie.

**Общее для всех брендов** (без фильтра по `getAdminBrandId()`): `staff`, `shift_logs`, `cash_sessions`, `cash_transactions`, финансовый модуль (`expense_categories`, `expenses`, `glovo_settlements`, `finance_settings`), склад целиком (`ingredients`, `ingredient_categories`, `ingredient_stock`, `semi_finished`, `semi_finished_items`, `product_recipes`, `suppliers`, `supply_orders` (+ `annulled_at`), `supply_order_items`, `stock_writeoffs`, `stock_audits`, `stock_ledger`), `profiles`, `customer_addresses`, `bonus_settings`, `bonus_transactions`.

**Исключения:**
- `/admin/orders` — фильтр по бренду только если в URL задан `brand_id` (не принудительно из cookie).
- `stock_writeoffs.brand_id` всегда вставляется как **`null`** в коде.
- `stock_audits.brand_id` при **создании** записывается из `getAdminBrandId()` (список и карточка — без фильтра).
- POS/KDS: cookie `pos-brand-slug` хранит активный бренд **для дисплея**, список заказов в KDS не фильтруется по бренду.

### Зоны доставки (`delivery_zones` + `delivery_zone_schedules`)

Типы в `src/types/database.ts`: `DeliveryZone`, `DeliveryZoneSchedule`, `DeliveryZoneWithSchedules`. Часовой пояс всех проверок времени — **Europe/Chisinau**.

**Базовые поля зоны** (`delivery_zones`): `polygon`, `color`, `delivery_price_bani`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `is_active`, `sort_order`, `brand_id`. Используются как fallback, когда у зоны **нет слотов** расписания или ни один слот не попадает в текущее время.

**Legacy-колонки зоны** (миграция `*_delivery_zones_night_and_window.sql`; в runtime **не** подменяют `delivery_zone_schedules` — только хранение/админка, пока не подключены в `resolveZoneParams`):

| Поле | Назначение |
|---|---|
| `night_delivery_price_bani` | Ночная цена доставки (23:00–05:59, Chisinau); `NULL` → `delivery_price_bani` |
| `active_from`, `active_to` | Окно доступности зоны (`HH:MM`); оба `NULL` → 24/7 на уровне legacy-полей |

В списке зон админки ночная цена показывается бейджем, если задана.

**Слоты расписания** (`delivery_zone_schedules`, FK `zone_id` ON DELETE CASCADE):

| Поле | Назначение |
|---|---|
| `from_time`, `to_time` | Окно слота (`TIME`, `HH:MM:SS` в API); через полночь: `from >= to` |
| `delivery_price_bani`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min` | Параметры доставки в этом окне |
| `sort_order` | Приоритет при пересечении (первый подходящий по `sort_order`) |

Нет слотов → зона на витрине/POS доступна круглосуточно с базовыми колонками. Есть слоты → зона видна только если сейчас попадает хотя бы в один слот (`isZoneAvailableNow`).

**`src/lib/delivery-zone-schedule.ts`:**

- `getActiveSchedule(schedules)` — активный слот сейчас или `null`.
- `isZoneAvailableNow(schedules)` — пустой массив слотов → `true`; иначе нужен активный слот.
- `resolveZoneParams(zone, schedules)` — параметры из активного слота или базовые коля зоны.
- `attachResolvedZoneParams(zone)` → `DeliveryZoneWithResolvedParams` с полем `resolvedParams` (чтобы клиент не пересчитывал время).

**Витрина / POS:** после `is_active = true` — `.filter(isZoneAvailableNow(delivery_zone_schedules))`. Стоимость и `deliveryZoneForEngine` — из `zone.resolvedParams` / `result.resolvedParams`, не из сырых колонок зоны. Центрально: `delivery-store.getDeliveryFeeBani`, `CartContent`, `checkout-view`, `DeliveryContent`, `order-form` (`DeliveryZoneInfo`).

**Загрузка зон:** `getActiveDeliveryZones` (`check-delivery-zone.ts`), `getZonesByBrandSlug` / `checkDeliveryZoneByAddress` (`check-delivery-zone-pos.ts`) — nested select `delivery_zone_schedules(...)`, на выходе зоны с `resolvedParams`.

**Админка** (`/admin/delivery-zones`):

- Список: все зоны бренда, **без** фильтра по времени; бейдж «N слотов» + tooltip с окнами (`11:00–23:00 · 40 MDL`).
- Редактор зоны (`zone-dialog.tsx`): базовые поля + секция **«Расписание работы зоны»** (`zone-schedules-section.tsx`) — CRUD слотов.
- Actions зоны: `createDeliveryZone`, `updateDeliveryZone`, `deleteDeliveryZone` (`actions.ts`).
- Actions слотов: `createSchedule`, `updateSchedule`, `deleteSchedule` (`lib/actions/admin/delivery-zone-schedules.ts`, service role, `revalidatePath('/admin/delivery-zones')`).

### Middleware (резолв бренда)

- По `Host` или префиксам `/losos`, `/thespot`: ставит заголовки `x-brand-slug` и `x-pathname`, делает rewrite (`/losos/checkout` → `/checkout`).
- `/admin/*` без сессии → `/admin/login`. `/api/admin/*` без сессии → **401 JSON** (не редирект).
- `/pos/manager-login` и `/pos/login` — только заголовки бренда, **без `getUser`**. Для остальных `/pos/*` — Supabase сессия + валидный `pos-session` (JWT), иначе редирект на `manager-login` или `login`.

## Auth

### Витрина (storefront-session)

httpOnly cookie. OTP-вход по телефону: 4 цифры через `lib/sms.ts` (`POST /api/auth/send-otp`, `verify-otp`); `brandSlug` по Host (`x-forwarded-host` / `host` → `getBrandByHost`, только при совпадении с `domain`/`devDomain`, иначе `SMS_MD_SENDER`). Клиентский `fetch` к `/api/auth/me`, `/api/account/*`, `/api/bonus/balance` — обязательно с `credentials: 'include'`. Сессия в коде: `getStorefrontSession()`.

**Приветственный бонус LOSOS:** при успешном `verify-otp` для бренда `losos` (`x-brand-slug`) server action начисляет 100 pts через `awardWelcomeBonus` (один раз на профиль, type=`welcome` в `bonus_transactions`) и возвращает `{ welcomeBonus: true|false }`. Клиент (`AuthModal`) после `closeAuth()` вызывает `setWelcomeBonusPending(true)` → модалка **`WelcomeBonusModal`** (`components/client/welcome-bonus-modal.tsx`, Vaul ≤1023px / Dialog на десктопе; подключена в `(client)/layout.tsx` рядом с `StoreClosedModal`). Состояние — `auth-store.welcomeBonusPending`.

### Админка

Supabase Auth email/password. Layout делает `Promise.all` для `getBrands()` + `getAdminBrandSlug()` + `auth.getUser()`. Сервер-side проверки — `getAdminSession()`.

### POS (двухслойный)

1. `/pos/manager-login` → Supabase Auth (менеджер).
2. `/pos/login` → PIN (`bcryptjs`), выпускает cookie `pos-session` (JWT HS256, библиотека `jose`, секрет `POS_SESSION_SECRET` **≥32 символов**).
3. Корневой `src/app/pos/layout.tsx`: `ensureActiveShift` (`shift_logs`) + проверка `cash_sessions(status=open)`. Без открытой кассы — блокирующий `CashSessionGate`.

Код: `src/lib/actions/pos/auth.ts`, `shifts.ts`. Внутри POS активный сотрудник — `getCurrentStaff()`.

**Смены (`shift_logs`) и выход:**

| Действие | Закрывает `shift_logs`? | Удаляет `pos-session`? |
|---|---|---|
| `logout()` | **Нет** — только `cookieStore.delete('pos-session')` | Да |
| `closeShift()` | Да (`clock_out` для открытых строк сотрудника) | Нет |
| «Закрыть смену» (`CloseShiftModal`) | Да — `closeCashSession` → `closeShift()` → `logout()` → Supabase `signOut()` | Да |
| «Выйти» (`PosLogoutButton`) | **Нет** | Да |

- `hasOpenShift()` — есть ли у текущего сотрудника строка в `shift_logs` с `clock_out IS NULL`.
- `verifyCurrentStaffPin(pin)` — сверка PIN текущего сотрудника по JWT, без повторного логина.
- `ensureActiveShift()` — находит или создаёт открытую смену при входе в POS (самая свежая при дублях).
- `closeShift()` — единственный server action для закрытия смены вне UI; вызывается из `CloseShiftModal` после закрытия кассы.

**`PosLogoutButton`:** при открытой смене — диалог «Подтвердите выход» с PIN (`verifyCurrentStaffPin`); при успехе — `logout()` + `/pos/login`. Без открытой смены — выход сразу. Смену при выходе не закрывает.

## POS

### Касса

Таблицы: `cash_sessions` (status `open`/`closed`, `opened_by_staff_id`, `closed_by_staff_id`, `discrepancy_reason`), `cash_transactions` (типы: `opening`, `order_payment`, `expense`, `income`, `encashment`; denormalized `order_delivery_mode`, `order_brand_id`, `encashment_destination`; `expense_category_id` nullable FK → `expense_categories` для `type='expense'`; legacy `category` пока сохраняется для совместимости; voiding через `voided_at`, `voided_by_staff_id`, `void_reason`; редактирование — `edited_at`, `edited_by_user_id`).

**Админка — правка/аннулирование ручных транзакций** (`lib/actions/admin/cash-sessions.ts`): `voidCashTransaction`, `editCashTransaction`. Доступ только для UUID из allowlist (`CASH_EDIT_ALLOWED_USER_IDS`); проверка через `getAdminSession().staffId`. Типы `expense` / `income` / `encashment`. UI: `components/admin/cash-sessions/cash-transaction-actions.tsx` (Dialog редактирования, Dialog аннулирования с причиной ≥3 символов); колонка «Действия» на `/admin/finance/cash-sessions/[id]` — `canEditTransactions` с сервера.

Server actions — `src/lib/actions/pos/cash-session.ts`: `openCashSession`, `getCashSession`, `getExpectedInDrawerBani`, `getActiveOrdersCountForShift`, `createCashTransaction`, `closeCashSession`, `payOrder`.

**POS ручные транзакции (`CreateTransactionModal`):** для `type='expense'` обязательна категория из `expense_categories`; категории грузятся через `getExpenseCategories` из `lib/actions/admin/finance.ts`. `createCashTransaction` пишет и legacy `category`, и новый `expense_category_id`. Для зарплатных категорий в UI есть поле сотрудника (локально в форме, без записи в `cash_transactions`).

**Инварианты `payOrder`:**

- Разрешён **только из** `status='delivery'` ИЛИ (`status='ready'` И `delivery_mode ∈ {pickup, aggregator}`).
- Атомарно проставляет `paid_at`, `status='done'`, `cash_session_id` (UPDATE ожидает текущий `delivery` или `ready`).
- В `cash_transactions` всегда denormalized `order_delivery_mode`, `order_brand_id`.
- **Glovo (`aggregator_card`): строка в `cash_transactions` НЕ создаётся**; в `orders` обновляется `payment_method` и `cash_session_id`.
- Наличные Glovo: одна строка `order_payment` как обычно.
- `mixed`: **две строки** `cash_transactions` (`order_payment`: нал + карта) по полям `orders.cash_amount` и `card_amount`; обе должны быть > 0, сумма равна «К оплате» (±1 бан).
- После успешной записи — `processBonusAccrualOnOrderDone(profileId, orderId, totalBani, bonus_multiplier ?? 1)` из `bonus.ts`. Ошибки начисления логируются, оплату не блокируют.

**Закрытие смены (`closeCashSession`):** обязательный `discrepancyReason` ≥3 непробельных символов при расхождении >50 MDL. Незавершённые заказы смены — предупреждение, не блок. Строки с `voided_at` исключены из агрегатов баланса.

Read-only + мутации админки: `src/lib/actions/admin/cash-sessions.ts` (`listCashSessions`, `getCashSessionDetail`, `listStaffForFilter`, `voidCashTransaction`, `editCashTransaction`).

### KDS (/pos/kds)

- Список — все заказы `status='cooking'`, без фильтра по бренду. Выборка через константу `KDS_ORDER_QUERY_SELECT` в `components/pos/kds/types.ts` (с `menu_items(category_id, menu_categories(workshop))`).
- **Realtime:** два канала на anon-клиенте — `kds-orders` (таблица `orders`) и `kds-order-items` (таблица `order_items`), `postgres_changes`, `event:*`, без server-side фильтров. Полная перезагрузка через `reloadCookingOrders`.
- Дополнительно: периодический `reloadCookingOrders` каждые **30 с** + при `visibilitychange` / `online` / `window.focus`. Отдельный `wakeTick` каждые **60 с** пересчитывает `isKdsCardActive` (lib/pos/kds-wakeup.ts) — «спящие» карточки предзаказа.
- «Готово» (`cooking → ready`): `update-order-status-kds.ts`, проставляет `ready_at`.
- **Фильтр цехов:** `menu_categories.workshop` ∈ `operator`, `pizza`, `kebab`, `sushi`. localStorage ключ `kds_workshops` (JSON-массив). `workshop=null` у категории — строка видима всегда. Заказ без видимых после фильтра позиций не рендерится.
- **Звуки:** `src/lib/pos/alert-sound.ts`. `playPosStatusUpdateSound()` при появлении нового `id` в `cooking` (вне `knownOrderIdsRef`). Bell-кнопка в шапке нужна для **unlock WebAudio на Chrome/Android**.

### POS (главная страница и Realtime)

- `src/app/pos/page.tsx`: слева `OrdersPanel` (24 ч активных + 50 «Выданных»; `ORDERS_POS_SELECT` в `src/lib/pos/fetch-orders.ts`); справа — `idle` (выбор типа: доставка / навынос / Glovo), `wizard` (мастер `OrderForm`) или `detail` (только `done`).
- **Временные кнопки RawBT** (правый верхний угол, только для отладки на Android): «ТЕСТ ПЕЧАТИ RawBT» (`rawbtPrintText`), «ТЕСТ: ОТКРЫТЬ ЯЩИК» (`rawbtOpenDrawer`).
- При монтировании страница один раз грузит `brands(id, name, slug)`, склеивает с `BrandConfig` в `wizardBrands` (`PosWizardBrandOption`), затем предзагружает меню всех брендов в `usePosMenuCache`.
- **Realtime POS:** два канала в `orders-panel.tsx` на anon-клиенте — `pos-orders` и `pos-order-items`, `postgres_changes`, `event:*`. На каждое событие — `reloadOrders()` → `fetchPosOrders` / `fetchCompletedPosOrders` + `mergeOrdersPreserveBrandSlug` (сохраняет `brand_slug` если ответ пришёл с пустым slug при том же `brand_id`). При `INSERT` в `orders` — `playPosNewOrderSound()`.
- Левая `OrderCard` (`components/pos/order-card.tsx`) — **только просмотр**: статус и курьер read-only. Все переходы статусов делаются из мастера/деталки (`update-order-status-kds`, `assign-courier-pos`, `payOrder`). Обводка карточки **`border-2`** по цвету статуса — `getStatusBorderColor(status)` (экспорт из того же файла; `StatusBadge` внутри). Статус **`ready`** — зелёная палитра. При выборе — чёрный inset-ring `ring-2 ring-inset ring-[#242424]`.
- Принять / отклонить заказ с сайта (`new` + `source='website'`) — только из `OrderDetail` (`accept-order-pos`, `reject-order-pos`).

### Мастер заказа (OrderForm)

Шаги: **Бренд → Оформление (меню + корзина) → Детали**. Привязан к `orderId`; `key={panel.orderId}` меняется только при явной смене заказа.

**Создание черновика** — `createDraftOrderPos`:
- Статус заказа при создании — **`new`** (не `draft`); далее `sendPosDraftToKitchen` принимает `draft` / `new` / `confirmed`.
- `delivery` / `pickup` — обычный заказ.
- `aggregator` — Glovo: ставит `aggregator='glovo'`, `payment_method='aggregator_card'`, `prep_deadline_at` = +15 мин.
- Из входящего звонка: `createDraftOrderPos({brandSlug, userPhone, profileId, userName})` — резолв `brand_id`, открытие мастера на шаге 2.

**Меню в мастере:** `usePosMenuCache` (на время браузерной POS-сессии: категории, items с вариантами и группами топпингов, индексы). Выборка `POS_MENU_ITEM_FOR_MODAL_SELECT` (`lib/pos/menu-item-modal-row.ts`) включает `aggregator_price_bani` для `menu_items`, `menu_item_variants` и nested `toppings`. Fallback — Supabase запрос с той же константой. Cookie `pos-brand-slug` обновляется при выборе бренда (синхронизация с KDS).

**Шаг «Оформление» (меню + корзина):**
- **`CartPanel`** (правая колонка, шаг 2): футер со сворачиваемым блоком **«Детали заказа»** (по умолчанию скрыт) — промокод (`PromoPanel`), строка назначенного курьера («Сменить»), разбивка скидок (`DiscountBreakdown` с `hideTotal`); всегда видны строка **«Итого»** (`DiscountOrderTotal`) и ряд CTA. Печать предчека — **иконка `Printer`** (~46px) слева от основной кнопки («Принять оплату» / «Назначить курьера» / «Отправить бегунок»), `aria-label="Печать предчека"`. Перед печатью — best-effort `persistCartToServer().catch()` + пауза 150 мс; offscreen `<ReceiptTemplate ref={receiptRef} {...receiptProps} />` (`position:absolute; left:-9999px`) → `printReceipt(node)` из `lib/receipt-print.ts`. Данные чека (`receiptProps` в `order-form.tsx`): номер заказа, дата, позиции корзины (имя, размер, топпинги; цена строки через **`getPosCartItemUnitPriceBani(item, isAggregator)`**), **`pricing`** через `buildReceiptPricingBreakdown` (`lib/receipt-pricing-breakdown.ts`): сумма без скидок / скидка на сеты / промокод / бонусы / доставка / итого; источник — `listOrder.subtotal|item_discount|promo_discount` (если в БД) или split `effectiveEngineOutput.appliedDiscounts` + legacy `discount`. Расчёт начисляемых бонусов (`accrual_rate` 5% × `bonusMultiplier`), баланс клиента, канал (`delivery` / `pickup` / Glovo). Disabled при пустой корзине.

**Корзина — optimistic:**
- `PosCartItem` / `PosCartTopping` (`src/types/pos.ts`): quantity-aware топпинги + `toppingGroupFreeCounts` (snapshot `free_count` из `menu_item_topping_groups`). Опционально `PosCartItem.aggregatorUnitPriceBani` (база позиции без топпингов) и `PosCartTopping.aggregator_price_bani` — заполняются из каталога при добавлении в модалке.
- Цена строки в UI и payload в БД — `pos-cart-helpers.ts`: `calcPosToppingsCharge(..., isAggregator)`, `getPosCartItemUnitPriceBani(item, isAggregator)`, `posLinePayloadFromCartItem(item, isAggregator)`, `posToppingsPayloadForDb(..., isAggregator)`, `getPosCartItemToppingDisplayLines`.
- `PosProductModal` принимает `isAggregator={deliveryMode === 'aggregator'}`; при сохранении в `order_items` server actions (`addOrderItemsPos`, `replaceOrderItemsPos`, `updateOrderItemCompositionPos`) сами определяют `isAggregator` по `orders.delivery_mode` и вызывают `posLinePayloadFromCartItem`.
- add/remove топпингов в модалке — `posAddTopping` / `posRemoveTopping` (`pos-cart-toppings.ts`); лимит группы — сумма `quantity` (`getTotalQuantityInGroup`).
- `addCartItem`, `updateQty`, `removeLine`, `saveCartLineFromModal`, `handleClearCart` сначала меняют локальный `cart` (`applyOptimisticCart`) → синхронно обновляют карточку слева через `updateOrderLocalState` (item_count, total, discount, delivery_fee, bonuses_redeemed) → в фоне зовут server actions (`addOrderItemsPos`, `updateOrderItemQuantityPos`, `removeOrderItemPos`, `updateOrderItemCompositionPos`, `replaceOrderItemsPos`).
- На ошибке — `rollbackOptimisticCart(snapshot, message)` + Sonner.
- Realtime подписки — финальная сверка.

**Шаг «Детали»:**
- Контакт: телефон **обязателен** для не-агрегатора, имя необязательно. Для Glovo контакты/адрес не требуются (Zod + `detailsArePersistable`).
- Адрес при `delivery`: `delivery_address` + структурные `address_*`; зона через `checkDeliveryZoneByAddress` (Nominatim + viewbox по полигонам активных зон бренда, `bounded=1`, `countrycodes=md`, `findZoneForPoint`).
- Время доставки (`ScheduledTimePicker`, `generateScheduledSlots`): `asap` или `HH:MM` → `orders.scheduled_time`. Слоты по `BrandConfig.openHour/closeHour`.
- Оплата: `cash` / `card` / `mixed`. Сохранение — сразу по клику (для `mixed` — только когда обе суммы согласованы с итогом, защита DB constraint).
- Дополнительно: `comment` (общий) и опционально `kitchen_note` (только для KDS).
- **Lookup клиента** (`posLookupCustomer`): по телефону, debounce 500 мс + дедупликация. Возвращает `customer` (профиль + `addresses[]`), отдельное поле `addresses: CustomerAddress[]`, баланс бонусов, `bonus_settings.max_redemption_rate` (id=1, дефолт 0.3 при сбое). Адреса подгружаются в `getCustomerByPhone` одним JOIN на `customer_addresses`.
- **Адрес на «Деталях» (delivery):** при найденном клиенте с сохранёнными адресами — карточки `PosAddressCards` (`components/pos/order-form/pos-address-cards.tsx`) вместо полей ввода; выбор карточки заполняет `delivery_address`, `address_*`, координаты и вызывает `checkDeliveryZoneByAddress`. «+ Новый адрес» — ручной ввод; после успешного «Отправить бегунок» новый адрес сохраняется через `posSaveCustomerAddress` (ошибка — `console.error`, отправку не блокирует). Состояние: `selectedAddressId`, `showNewAddressForm`.
- **Списание бонусов:** поле при найденном клиенте, `total > 0`, `balance > 0`. Потолок считается от **subtotal после скидок движка** (`effectiveSubtotalBani` = `itemSubtotal − totalDiscount − giftItemsValue` с учётом overlap `cheapest_item_free`), не от gross: `floor(min(balance, effectiveSubtotal_mdl × max_redemption_rate))`. При активной акции (`promotionActive`: любой `appliedDiscounts` с `effect_type ≠ bonus_multiplier` или непустой `giftItems`) — инпут disabled, подпись «Бонусы недоступны при активной акции», локальное списание = 0.
- Все правки на «Деталях» уходят через `updateOrderDetailsPos` с **debounce 600 мс** (контакт, адрес, координаты, comment, kitchen_note, profile_id, скидки, промо, синхронизация подарочных строк).

**Скидки в мастере:** `getActiveDiscountRules` (`trigger_type='auto'`) загружается на сервере; промокод через `PromoPanel` + `resolvePromoCode` (`discounts.ts`); финальный расчёт через `evaluateDiscounts` (`src/lib/discount-engine.ts`) с `excludedCategoryIds` из `usePosMenuCache`. UI разбивки — `discount-breakdown.tsx` (`DiscountBreakdown`, `DiscountOrderTotal`, проп `hideTotal` для сворачиваемого футера `CartPanel`). Для заказов с сайта с непустым `promo_code` — флаг `skipSeedResolve` (быстрый показ без асинхронного `resolvePromoCode`).

**Меню `⋯` мастера:** «Сделать доставкой» / «Сделать навыносом» (`updateOrderDeliveryModePos` — сбрасывает `aggregator`, `prep_deadline_at`, `scheduled_time` при переходе на pickup; нормализует `aggregator_card → cash`). При смене типа заказа **с** или **на** `aggregator`, если корзина не пуста — confirmation «При смене типа заказа корзина будет очищена»; после подтверждения — `replaceOrderItemsPos([])` и смена режима. «Очистить корзину», «Закрыть заказ» (`cancelOrderPos`).

**«Отправить бегунок»** — `sendPosDraftToKitchen`:
- Действует для `draft` / `new` / `confirmed` → `cooking`. Идемпотентно: уже в `cooking` — успех с тем же id. POS-черновики создаются со статусом **`new`** (`createDraftOrderPos`), не `draft`.
- **До** UPDATE статуса: проверка активных авто-правил (`discount_rules`, `trigger_type='auto'`, `is_active`, `isRuleScheduleActive`, `effect_type ≠ bonus_multiplier`). При активной акции — `UPDATE bonuses_redeemed = 0`, `redeemBonus` **не** вызывается (`console.warn '[POS] bonuses cleared: active promotion'`), итог пересчитывается без бонусов; ошибка оператору не показывается.
- Иначе, если `bonuses_redeemed > 0` и есть `profile_id` — свежий fetch заказа; списание через `redeemBonus` только пока статус ещё в `SENDABLE_POS_STATUSES` (`draft` / `new` / `confirmed`). Повторный клик после перехода в `cooking` — guard + идемпотентность в `redeemBonus`, двойного списания нет.
- UPDATE: `cooking_started_at`, `updated_at`. Пересчёт `total` только под **списание бонусов**: берёт уже сохранённый `orders.total` (нетто), восстанавливает gross (`+ bonuses_redeemed × 100`), вычитает новое списание → `bonuses_redeemed`. **Не** пересчитывает subtotal из каталога/`aggregator_price_bani` — агрегаторные цены должны быть записаны в `order_items` на шаге «Оформление» (`replaceOrderItemsPos` / `addOrderItemsPos`). Ошибки `redeemBonus` — только в `console.error`, заказ не откатывается.
- После успеха на шаге «Детали»: если введён **новый** адрес (`showNewAddressForm`) и есть `profile_id` — best-effort `posSaveCustomerAddress` (не блокирует отправку).
- Мастер остаётся открытым на том же `orderId`.

**«Назначить курьера»** — только из мастера, шаг «Оформление»:
- Условие: `status='ready'` + `delivery_mode='delivery'`. Glovo (`aggregator`) — курьер не назначается.
- Гейт `courierButtonGate`: для обычной доставки нужны `user_phone` И `delivery_address`; для pickup адрес не нужен. Без них кнопка disabled, модалка не открывается.
- `assignCourierPos`: `status='delivery'`, `courier_id`, `courier_assigned_at`, Telegram-карточка (см. раздел Telegram).
- «Сменить» в `delivery` — модалка та же, режим `reassign`: старая карточка → `editMessageText "передан другому"`, новый курьер получает новую пару сообщений.

**Шаг «Бренд»:** при уходе со шага в фоне зовётся `persistBrandOrError` (`updateOrderBrandPos`), без ожидания. При переходе со шага 2 на 1 или 3 — `persistCartToServer` (`replaceOrderItemsPos`) вызывается только если отпечаток корзины изменился (`cartFingerprint` vs `lastSyncedCartFingerprintRef`).

### Glovo (delivery_mode='aggregator')

- Создание: `createDraftOrderPos({deliveryMode:'aggregator'})` → `aggregator='glovo'`, `payment_method='aggregator_card'`, `prep_deadline_at` +15 мин.
- **Цены:** в корзине POS и в `order_items` используются `aggregator_price_bani` из `menu_items` / `menu_item_variants` / `toppings`, если заданы; иначе — обычная `price`. Логика — `posLinePayloadFromCartItem(cartItem, isAggregator)` (server: `update-order-items.ts`, `create-order-pos.ts` читают `delivery_mode`).
- В мастере на «Деталях»: только блок «Заказ Glovo», оплата (наличные / `aggregator_card`), `comment`. Контакты и адрес скрыты. `runDetailsSaveToServer` передаёт `deliveryAddress=undefined`, `delivery_lat/lng=null`.
- Оплата по `payOrder` сразу из `ready` (без перехода в `delivery`).
- Карта Glovo → строка в `cash_transactions` не пишется (см. инварианты `payOrder`).
- При смене режима на не-aggregator: `updateOrderDeliveryModePos` сбрасывает `aggregator`, `prep_deadline_at`, нормализует `aggregator_card → cash`; при непустой корзине — confirmation и очистка (см. меню `⋯`).

### Шапка POS и входящие звонки

- `PosAppShell` после открытия кассы: логотип, `PosClockWidget`, `PosShiftTimer`, `PosLogoutButton` (см. таблицу выхода в Auth), «Карта курьеров» (`CourierMapModal` — react-leaflet через `dynamic({ssr:false})`, маркеры из `courier_locations` + `staff`, патч иконки `lib/leaflet-fix-default-icon.ts`).
- Меню `⋯` — `PosActionsMenu`: «Создать транзакцию» (`CreateTransactionModal` + `createCashTransaction`), «Данные смены» (`ShiftDataModal` + `getCashSession`: `payment_breakdown`, `manual_breakdown`, `recent_manual_transactions`), «Закрыть смену» (`CloseShiftModal` → `closeCashSession` → `closeShift()` → `logout()` → Supabase `signOut()`, редирект на `/pos`).

**Входящие звонки:**
- Webhook ОАТС: `POST /api/pbx/incoming` (`PBX_WEBHOOK_TOKEN` в поле `crm_token`). Принимает `cmd` ∈ `contact` / `event` / `history` → таблица `pbx_calls`. `brand_slug` определяется по линии через `lib/pbx/diversion-brand-slug.ts` (поля `diversion` / `called` / `to`):
  - 79700290 → `kitch-pizza`
  - 79200190 → `losos`
  - 79200120 → `the-spot`
- Ответ всегда 200 при DB-ошибках (чтобы АТС не ретраила); 401/400 только для токена и неизвестного `cmd`.
- POS подписка: `useIncomingCall` в `PosAppShell` — Realtime канал `pbx-realtime`, событие `INSERT` на `pbx_calls` с `cmd='event'`, `event_type='INCOMING'`. Догружается имя профиля и `brand_slug` с contact-строки того же `callid`.
- Диалог в `PosAppShell` с кнопкой «Создать заказ» → мост `pos-order-from-call-bridge` (`src/lib/store/pos-order-from-call-bridge.ts`), регистрация колбэка в `/pos/page.tsx` (`openNewOrderFromCall`).
- **Legacy:** `POST /api/pbx-webhook` (MoldCell) → upsert в `incoming_calls` по `call_id`, тот же маппинг линий. Параллельный баннер в `orders-panel.tsx` — без изменения основного флоу.

### OrderDetail (правая панель)

- Загрузка через `fetchPosOrderById` + Realtime по заказу и строкам.
- Кнопки внизу: `WebsiteNewActions` (принять/отклонить) для `new` + `source='website'`; «Передать курьеру» (`ready` + delivery, обычная); «Принять оплату» (`delivery` или (`ready` + aggregator/pickup)).
- При `interactionMode='readonly'` (статус `done`, список «Выданные» в Sheet) — только просмотр.
- Редактирование позиций: `POS_MENU_ITEM_FOR_MODAL_SELECT`, `posMenuRowForModal`, `PosProductModal` (`isAggregator` по `order.delivery_mode`; quantity-aware топпинги, `ToppingStepperCard`). Минус при qty=1 снимает строку. `updateOrderItemCompositionPos({ cartItem })`.

### POS — прочее

- **Высота:** `PosAppShell` — `h-screen` + `overflow-hidden`; scrolls только внутри панелей.
- **Cмены курьеров:** через **отдельного** Telegram-бота. `POST /api/telegram`, таблица `courier_locations`, команды `/shift_start`, `/shift_end`, привязка по deep-link из `/admin/staff` (`generateTelegramLink`, `TELEGRAM_COURIER_BOT_USERNAME` без `@`).

### Печать чека (RawBT, Android)

Только **клиент** в браузере POS на Android с приложением RawBT (`package=ru.a402d.rawbtprinter`). На десктопе intent не срабатывает.

| Файл | Назначение |
|---|---|
| `src/lib/rawbt.ts` | `rawbtPrintText(text)` — печать текста через intent; `rawbtOpenDrawer()` — команда ESC p, pin 2 (`\x1B\x70\x00\x19\xFA`) |
| `src/lib/receipt-print.ts` | `printReceipt(node)` — `html-to-image` `toPng` (576px, `pixelRatio:1`, `#fff`) → payload `rawbt:data:image/png;base64,...` (без `encodeURIComponent`) |
| `src/lib/receipt-pricing-breakdown.ts` | `buildReceiptPricingBreakdown` — сборка `pricing` для чека из полей заказа / движка скидок |
| `src/components/ReceiptTemplate.tsx` | Шаблон предчека: 576px (лента 80 мм), только `#000`/`#fff`, логотип бренда, инверсная шапка/ИТОГО, позиции, **breakdown** (`pricing`: сумма без скидок → скидка на сеты → промокод → бонусы → доставка → итого; legacy fallback — одна строка «скидка»), блок начисляемых бонусов, QR, футер; RU/RO подписи |

**Поток предчека:** рендер offscreen DOM → snapshot PNG → inline intent RawBT. Перед snapshot — `document.fonts.ready`. Перед печатью в мастере — sync корзины (`persistCartToServer`) и короткая пауза для пересчёта движка скидок.

**Тестовые кнопки** на главной POS (`page.tsx`) — см. раздел «POS (главная страница)».

## Telegram

### Боты и каналы

| Бот / канал | Назначение | Env |
|---|---|---|
| Заказы с витрины | Уведомления в общий чат: **`sendNewOrderTelegramNotification(orderId)`** в `create-order.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

**Когда шлётся:** при `cash` / `card` — сразу после `createOrder`. При **`online_card`** — **не** при создании; после успешного callback MAIB (`POST /api/maib/callback`, `status=OK`) → `paid_at`, `maib_pay_id`, затем `sendNewOrderTelegramNotification`.
| Курьерский | Привязка курьеров, смены, live location, карточки заказов | `TELEGRAM_COURIER_BOT_TOKEN`, `TELEGRAM_COURIER_BOT_USERNAME`, `TELEGRAM_COURIER_WEBHOOK_SECRET` |
| Негативные отзывы | `sendNegativeFeedbackTelegram` после POST feedback (оценка ≤4); HTML в чат; при `photo_urls[0]` — `sendPhoto` (signed URL из bucket `feedback-photos`) | `TELEGRAM_FEEDBACK_BOT_TOKEN`, `TELEGRAM_FEEDBACK_CHAT_ID` |

### Курьерский бот

- Webhook: `POST /api/telegram` с заголовком `X-Telegram-Bot-Api-Secret-Token`. Команды: `/start` (привязка по токену), `/shift_start`, `/shift_end`; live location → `courier_locations`.
- Исходящие — через `src/lib/telegram/bot.ts`: `sendMessage(chatId, text, replyMarkup?)` → `message_id`, `sendLocation(chatId, lat, lng, replyToMessageId?)`, `editMessageText(chatId, messageId, text, replyMarkup?)`.
- При assign (`sendCourierAssignmentTelegram` в `courier-telegram-message.ts`):
  1. `sendMessage` — карточка заказа (`buildCourierAssignmentMessage`): заголовок «🛵 Новый заказ #N», опционально 👤 имя, 📞 телефон, 📍 адрес (через `posCheckoutAddressFieldsFromOrder` / `split-composite-delivery-address`), **🕐 Доставить до:** расчётное время = `created_at` + 1 ч (`Europe/Chisinau`, `estimatedDeliveryTime`), блок «Состав заказа» (`• qty x name — price MDL` из `order_items.price` в bani). Блок оплаты: 💳 способ (`Наличными` / `Картой` / `Смешанная оплата`), **💰 ИТОГОВАЯ СУММА** = `orders.total` (финальная сумма со всеми скидками, бонусами и доставкой), 👉 «Взять у клиента» / «Принять картой»; для наличных с `change_from` — строка сдачи. Промежуточные «сумма без скидок / доставка отдельно» **убраны**, чтобы курьеры не путались. Select (`COURIER_ORDER_ASSIGNMENT_SELECT`, `COURIER_ORDER_TELEGRAM_SELECT`) включает `created_at`, `total`, `delivery_fee`, `change_from`.
  2. `sendLocation` с `reply_to_message_id` к карточке, если есть координаты (иначе `withResolvedDeliveryCoords` + `checkDeliveryZoneByAddress`).
  3. В `orders` пишутся `courier_tg_chat_id`, `courier_tg_message_id` (**только текстовая карточка**, для `editMessageText`), `courier_tg_message_updated_at`.
- При смене курьера: старая карточка правится через `editPreviousCourierAssignmentTelegram`, новому курьеру — новая пара.
- Обновления (`refreshCourierOrderTelegramMessage`) после `update-order-items` и `update-order-details-pos` в `delivery`: `editMessageText` карточки; при `reason='details'` дополнительно `sendLocation`. Короткое update-notice через `sendMessage` — **не чаще 1/мин** (throttle по `courier_tg_message_updated_at`).
- Регистрация webhook: `npm run setup:telegram` (`scripts/setup-telegram-webhook.ts`, требует `NEXT_PUBLIC_APP_URL`).

## Скидки и лояльность

### Серверный расчёт цены (`lib/pricing.ts`)

**`calculateOrderPricing(supabase, input)`** — единый server-side расчёт для витрины (без Supabase внутри функции — клиент передаётся параметром).

**Вход:** `cartItems[]` (`menu_item_id`, `quantity`, `variant_id?`), `brandId`, опционально `promoCode`, `profileId`, `bonusesRequested` (MDL), `deliveryFeeBani`.

**Логика:**
1. Цены из `menu_items` / `menu_item_variants`; `original_price` через `calcCompareAt(price, discount_percent)`; при `discount_percent = 0` → `original_price = price`.
2. `subtotal_bani` = Σ(original × qty); `item_discount_bani` = Σ((original − price) × qty) из `discount_percent`.
2b. **Кампании `item_percent`:** fetch `discount_rules` (`.eq('brand_id', brandId)`, `trigger_type='auto'`, `effect_type='item_percent'`, `is_active`); фильтр `isRuleScheduleActive`. Для каждой строки — правило с `brand_id === brandId` и `target_item_ids.includes(menu_item_id)` (по приоритету) **заменяет** скидку строки (не суммирует с `discount_percent`): `rate = discountRateFromEffectValue(effect_value)` (`lib/discount.ts`; доля 0.2 или legacy-процент 20 → 0.2), `item_discount_bani = round(original × rate) × qty`. Пересчёт `subtotal_bani` / `item_discount_bani`. В `discount_rules_applied` — отдельные строки с `label` = `rule.name` / `label_ru`; legacy «Скидка на товары» — только для позиций без кампании.
3. Флаг **`active_promotion`**: любое schedule-active авто-правило с `effect_type ≠ bonus_multiplier` (не только `item_percent`).
4. Промокод — валидация как в `validate-promo-code.ts` (в т.ч. `min_order_bani` по **полному** `subtotal_bani`); **`promo_discount`** через `calcPromoDiscount` только по **eligible subtotal** — сумма `original_price × qty` строк, чья `menu_items.category_id` **не** в категориях с `exclude_from_discounts = true` (fetch `menu_categories` по `brand_id`). Если eligible subtotal = 0 → `promo_discount_bani = 0`. При промокоде **или** `active_promotion`: **`bonuses_blocked = true`**, `bonuses_redeemed = 0`.
5. Без блокировки бонусов: `max_bonuses_redeemable = floor(subtotal_mdl × max(0, 30 − item_discount_pct) / 100)` (MDL); списание = `min(requested, balance, max)`.
6. `total_bani = subtotal − item_discount − promo_discount − bonuses×100 + delivery_fee`.
7. `discount_rules_applied` — JSON `[{ type: 'item_discount'|'promo_code'|'bonus_redemption', label, amount_bani }]`.

**Ответ `PricingResult`:** incl. `active_promotion: boolean`.

**Баланс бонусов:** последний `balance_after` из `bonus_transactions` (не колонка `profiles`).

**Ограничение:** расчёт по каталогу (база + `discount_percent` / `item_percent`); **топпинги и gift-rules движка не включены** — для строк с платными топпингами server total может отличаться от UI корзины.

**API:** `POST /api/[brandSlug]/checkout/pricing` — тело `{ items, delivery_fee, delivery_mode, promo_code?, bonuses_to_redeem? }`; ответ — `PricingResult`. Сессия опциональна: без auth → `bonuses_available = 0`, `bonuses_redeemed = 0`. Хелпер бренда — `resolveBrandIdBySlug` (`lib/resolve-brand-id.ts`).

**Checkout UI:** `useCheckoutPricing` (debounce 300 ms) → breakdown в `OrderSummary` (`pricingBreakdown` + `discountRulesApplied` из `discount_rules_applied`). Строки скидки на товары — **по `label` кампании** из сервера; i18n `pricingItemDiscount` («Скидка на сеты») — только fallback для legacy `discount_percent` без кампании. `BonusRedeemBlock` — числовой ввод MDL, «Макс. списание…»; disabled + tooltip при промокоде («Промокод и бонусы нельзя совмещать») или при `active_promotion` («Бонусы недоступны при активной акции» / RO-аналог).

**Создание заказа с витрины:** `create-order.ts` → `executeCreateOrder` вызывает `calculateOrderPricing` перед insert; **`total`, `subtotal`, `item_discount`, `promo_discount`, `discount`, `discount_rules_applied`, `bonuses_redeemed`** — только с сервера; значения с фронта не доверяются.

### Движок скидок (legacy POS / корзина UI)

`src/lib/discount-engine.ts`: чистая функция `evaluateDiscounts(input)` + `isRuleScheduleActive`. Без Supabase.

Типы эффектов (`src/types/promotions.ts`): `item_percent`, `order_percent`, `order_fixed`, `cheapest_item_free`, `free_delivery`, `bonus_multiplier`, подарки.

**`cheapest_item_free`:** правило `free_every_n` + опциональный потолок **`max_free_items`** (ограничивает число бесплатных единиц за применение правила). Результат — `giftItems: GiftCartItem[]` (`menu_item_id`, `variant_id`, `quantity`, `rule_id`, `label_ru`).

`DiscountEngineInput.excludedCategoryIds` — категории `menu_categories.exclude_from_discounts`. Не участвуют в `order_percent`, `order_fixed`, `cheapest_item_free`. **`item_percent`:** категория с `exclude_from_discounts` **не блокирует** позицию, если её `menu_item_id` явно в `rule.target_item_ids` (кампании на комбо Kitch); иначе — пропуск. На `free_delivery`, `bonus_multiplier`, подарки — не влияют.

Источники: таблица `discount_rules` (`trigger_type='auto'` или `promo_code`) + `promo_codes` (legacy, через синтетическое правило в `resolvePromoCode`). **`effect_value`:** канонически **доля** (0.2 = 20% для `item_percent` / `order_percent`); в админке (`rule-dialog.tsx`) ввод в процентах, на сервер уходит ÷100. В runtime для `item_percent` — **`discountRateFromEffectValue`** (доля или legacy-процент 1–100).

В `orders` сохраняется: **`subtotal`, `item_discount`, `promo_discount`, `discount`** (= item + promo), `discount_rules_applied`, `promo_code`, `delivery_fee`, `bonus_multiplier`. Подарочные строки — `order_items.is_gift` + `gift_rule_id`. На витрине после `create-order` также **`order_items.original_price`, `item_discount_pct`**.

POS-мастер по-прежнему использует **`evaluateDiscounts`** для UI и `update-order-details-pos`; поля разбивки в БД для POS заполняются по мере миграции логики сохранения.

Bootstrap для витрины — `getStorefrontCartPricingBootstrap` в `discounts.ts`: авто-правила, `excludedDiscountCategoryIds`, `storefrontExcludedDiscountCategories` (с именами категорий для подсказок). Отдельно **`getStorefrontItemPercentCampaignRules`** — только `item_percent` для отображения цен в меню; загружается в `(client)/layout.tsx` и передаётся в `StorefrontCampaignRulesProvider` (`ClientChrome`).

**Отображение per-item скидки на витрине (UI, без изменения server pricing):** `getItemCampaignDiscount` (`lib/storefront-item-campaign-discount.ts`) + `isRuleScheduleActive` + `discountRateFromEffectValue`. Активная кампания `item_percent` на `menu_item_id` → зачёркнутая `originalPriceBani` (= shelf price), основная — `discountedPriceBani = round(price × (1 − rate))`. Без кампании — legacy `calcCompareAt` по `discount_percent` в БД (Kitch!, только чтение). Правила — `StorefrontCampaignRulesProvider` (`getStorefrontItemPercentCampaignRules`); fallback в корзине — `item_percent` из `getStorefrontCartPricingBootstrap`. Используется в `getMenuItemPriceLabels` (`menu-item-card.tsx`), `featured-menu-section.tsx`, `ProductModalRoot`, **`CartItemCard`** (drawer/panel корзины).

Сборка корзины витрины — `src/components/client/cart/storefront-cart-pricing.ts` (`CartItemForEngine` + `evaluateStorefrontCartDiscount` → `evaluateDiscounts`; **`allocateGiftFreeUnitsByCartLineId`** — раздаёт `giftItems.quantity` по строкам корзины в порядке `items`). Подсказки: `storefront-discount-excluded-notice.tsx`, `storefront-promo-excluded-warning.tsx`.

**Цены строк в корзине витрины (`CartItemCard`):** per-item кампания — зачёркнутая оригинальная сумма строки + цена со скидкой (`getItemCampaignDiscount` на `getCartItemPrice`, incl. топпинги). Подарки (`giftFreeUnits` из `allocateGiftFreeUnitsByCartLineId`) — зачёркнутая бесплатная часть + зелёное «0 лей»; при частично платной строке — сумма за платные единицы (с учётом item_percent, если есть). Итоговая строка «Reducere» / `totalDiscountBani` внизу `CartContent` — без изменений (движок `evaluateDiscounts`).

В POS-мастере: `mergePersistedWebsitePromoDiscount` подмешивает сохранённое `listOrder.promo_code` / `discount` пока движок ещё не дал полный выход.

### Лояльность

Таблицы: `bonus_settings` (id=1; `accrual_rate`, `max_redemption_rate`, `is_enabled`, `updated_at`), `bonus_transactions` (`profile_id`, `amount`, `balance_after`, `type` incl. `welcome`, `created_by`).

Lib: `src/lib/bonus.ts`. Все функции — service role (`createServiceSupabaseClient`).

- `getUserBalance(profileId)` — последняя `balance_after` в `bonus_transactions` (**витрина, POS, `/api/bonus/balance`**).
- **`getActualBalance(profileId)`** — `src/lib/admin/get-actual-balance.ts`: тот же алгоритм (последний `balance_after`); **админка** — заголовок `/admin/customers/[id]` и `POST /api/admin/bonus/adjust` (расчёт `balance_after` новой транзакции = текущий ± сумма).
- `getBonusSettings()`, `manualAdjust`, `accrueBonus`, `redeemBonus`, `processBonusAccrualOnOrderDone(profileId, orderId, totalBani, multiplier?)`.
- **`redeemBonus(profileId, orderId, amount)`** — идемпотентно: перед insert проверяет существующую транзакцию `type='redemption'` для пары `profile_id + order_id`; при повторе — `console.warn`, без второго списания. Вызывается из `sendPosDraftToKitchen` (POS) и `create-order.ts` (витрина).
- **`awardWelcomeBonus(profileId)`** — одноразовый welcome-бонус 100 pts (type=`welcome`, note «Приветственный бонус LOSOS»); вызывается из `verify-otp` для бренда `losos`. Идемпотентно: повторно не начисляет.

**Список клиентов (RPC `get_customers_list`):**

- RPC возвращает реальные заказы из `orders` (`status='done'`, все бренды) + legacy Poster из `profiles`:
  - `orders_count`, `total_spent_bani`, `total_count` — **bigint → string** в JS (каст `Number()` в UI/action).
  - `last_order_at` — последний done-заказ; `poster_orders_count`, `poster_last_order_at` — legacy Poster (nullable).
  - `bonus_balance` — последний `balance_after` (integer).
- Server action `lib/actions/admin/customers-list.ts` → `getCustomersList(filters, page)` (service role, `CUSTOMERS_PAGE_SIZE = 50`). Сырой тип строки — `CustomerListRpcRow`; клиентский — `CustomerRow` (`src/types/customers.ts`, bigint-поля как `string`).
- Страница `/admin/customers`: RSC `page.tsx` читает `?search=`, `?page=`; клиент **`CustomersPageClient`** (`components/admin/customers/`): поиск (debounce), **Popover-фильтры** (`customers-filters.tsx`: сортировка `created_at` | `orders_count` | `total_spent` | `last_order_at` | `bonus_balance` | `name`, мин. заказов, только с бонусами, даты регистрации, активность 30/60/90/180 дней), таблица (`customers-table.tsx`), пагинация `« ‹ › »`.
- Колонки таблицы: клиент (телефон + имя), регистрация, заказов (`Number(orders_count)`; tooltip «Сайт: N · Poster: M» только если `poster_orders_count != null`), потрачено (`Number(total_spent_bani) / 100` MDL), последний заказ (`last_order_at ?? poster_last_order_at`), бонусы. Клик → `/admin/customers/[id]`.
- Legacy RPC `admin_customers_list` — заменён на `get_customers_list` в UI.

**Начисление** (после успешного `payOrder`): `Math.round((totalBani / 100) × accrual_rate × bonus_multiplier)`. `totalBani` уже с учётом списанных бонусов. Ошибки логируются, оплату не блокируют.

**Списание** (`redeemBonus`): из `sendPosDraftToKitchen` (POS, до UPDATE в `cooking`) и `create-order.ts` (витрина). Двойное списание по одному заказу блокируется идемпотентностью в `redeemBonus` + guard статуса в `sendPosDraftToKitchen`.

Кэшбек **единый для всех брендов** (5% по умолчанию).

## Склад

### Журнал движений (stock_ledger)

Поля: `ingredient_id`, `movement_type`, `reference_type`, `reference_id`, `quantity_delta`, `cost_per_unit`, `note`, `created_at`.

`movement_type` (CHECK в миграции): `supply`, `sale`, `writeoff`, `audit` / `audit_adjustment`, `manual`.
`reference_type`: `supply_order`, `stock_writeoff`, `stock_audit`.

### Поставки (supply_orders)

- `supply_order_items.received_qty` — nullable колонка в БД (legacy). **UI создания** (`supply-order-dialog.tsx`) использует только **Количество**; на сервере `stock_qty = received_qty ?? quantity` (для новых поставок — `quantity`).
- `supply_orders.annulled_at` — timestamptz, NULL = активная поставка. Аннулирование не удаляет строки.
- **Модалка поставки** (`inventory/supplies/supply-order-dialog.tsx`): колонки **Количество**, цена за ед. без/с НДС, НДС %, цена с НДС / ед., **Итого без НДС**, **Итого с НДС**. **Двусторонний пересчёт** — можно ввести любое из полей цены/итога, остальные заполняются автоматически (`priceAnchor`: `unit_ex` | `unit_inc` | `line_ex` | `line_inc`). Итоги по строке и футер поставки — `количество × цена`. Числовые инпуты — единая ширина (`SUPPLY_ROW_INPUT_CLASS`, 132px).
- `createSupplyOrder` (`inventory/supplies/actions.ts`): вставка заказа и строк, `total_cost_ex_vat` / `total_cost_inc_vat` по строкам; пополнение склада — RPC **`apply_supply_order_stock_items(p_order_id, p_items, p_note?)`** (миграции `*_apply_supply_stock_rpc.sql`, `*_revert_supply_stock_and_update.sql`, service role): для каждой позиции **upsert** `ingredient_stock` (средневзвешенный `avg_cost`) и `stock_ledger` (`movement_type='supply'`, `reference_type='supply_order'`). Количество на склад — `received_qty ?? quantity`. При ошибке RPC откатываются строки и заголовок заказа.
- **`updateSupplyOrder(orderId, payload)`** (service role): редактирование **активной** поставки (`annulled_at IS NULL`). Порядок: обновление шапки `supply_orders` + замена `supply_order_items`; затем RPC **`replace_supply_order_stock_items`** (атомарно: откат старых строк через `revert_supply_order_stock_items` + применение новых через `apply_supply_order_stock_items`). В `stock_ledger`: откат — `movement_type='manual'`, note «Редактирование поставки (откат)»; применение — `movement_type='supply'`, note «Редактирование поставки (применение)». При ошибке RPC строки поставки восстанавливаются из снимка. Блокировка при недостатке остатка для отката.
- `annulSupplyOrder(orderId)` (service role): один RPC **`annul_supply_order_stock(p_order_id)`** — атомарно: проверка «не аннулирована», откат `ingredient_stock` / `avg_cost`, `stock_ledger`, `annulled_at`. Ошибки БД — через `throw new Error(error.message)`.
- **UI** (`supply-order-dialog.tsx`): режимы `create` | `edit` | `view`. Типы — `inventory/supplies/types.ts` (`SupplyOrderViewModel`, `SupplyPeriodTotals`). Активная поставка открывается в **edit** (редактируемые поля, «Сохранить» → `updateSupplyOrder` с confirm «пересчитает остатки»). Аннулированная — только **view**. В edit доступно аннулирование.
- **Список поставок** (`supplies-table.tsx`, RSC `page.tsx`): фильтр периода через общий **`PeriodFilter`** (`?from=` / `?to=`, дефолт — текущий месяц, как в финансах); выборка на сервере `.gte/.lte('delivery_date')`. Три summary-карточки: число **активных** поставок, **потрачено без НДС** / **с НДС** (MDL; аннулированные в таблице видны, в суммы **не** входят). Клиентский поиск по поставщику, позициям, дате. Кнопки **«Из фото»** (OCR) и **«Новая поставка»**. Бейдж «Аннулирована». Страница — `force-dynamic`; поставщики `select id, name, is_active`; вложенные `supply_order_items` нормализуются в массив (`asRelationArray`, как на semi-finished).
- **`avg_cost`** пересчитывается **средневзвешенно** по цене поставки (ex-VAT).
- В UI ручной модалки: цены без НДС и с НДС синхронно (общая VAT % по строке); в БД — ex-VAT, в g/ml через `toStoragePrice`.

#### OCR накладной (фото → поставка)

- **API** `POST /api/admin/inventory/ocr-invoice` (`route.ts`, `force-dynamic`): auth — `getAdminSession()` → 401 без сессии; body — `multipart/form-data`, поле `image`. OpenAI Chat Completions через `fetch()` (без SDK), env **`OPENAI_API_KEY`**.
  - **Шаг 1** — `gpt-5.4-mini`, image + prompt: извлечение позиций (FACTURA / чеки супермаркета). `image_url.detail: "high"`. `unit_price` и `total_price` — **без НДС** (фактура: колонка Pret fara TVA; чек: shelf price ÷ (1 + vat_rate/100)); `vat_rate` 20/8/0 (буквы A/B/C на чеке, Cota TVA % на фактуре).
  - **Шаг 2** — `gpt-5.4-nano`, text-only: матчинг к `ingredients` + `suppliers` из БД (service role), `display_quantity` в display-единицах накладной (кг/л/шт, без ×1000).
  - Ответы JSON: `extractJson()` (снятие markdown fences), при ошибке parse — `ocr_parse_failed` / `match_parse_failed` (+ `raw`); ошибки OpenAI — `openai_error` с `console.error` тела ответа.
- **Типы** — `src/lib/admin/inventory/invoice-ocr-types.ts`: `OcrRawItem`, `OcrMatchedItem` (`vat_rate`, `display_quantity`, `confidence`), `OcrInvoiceResult`.
- **Модалка** `invoice-ocr-modal.tsx` (Vaul ≤768px / Dialog desktop): шаги `capture` → `processing` → `review` → `confirm`. Съёмка/галерея; сжатие только если файл **>8 MB** (canvas max 2400px, JPEG 92%). Review: карточки с confidence, `IngredientCombobox`, `InvoiceNumberInput` (text + `inputMode=decimal`), селектор НДС, итого с НДС по строке; прокручиваемый список + фиксированный footer с **итогом по поставке**. Confirm → `onComplete(InvoiceOcrCompletePayload)`.
- **Создание поставки** (`supplies-table.tsx` → `handleOcrComplete`): `createSupplyOrder` с `note: "Создано из фото накладной"`; `quantity` = `toStorageQty(display_quantity, unit)`; `price_per_unit` = `toStoragePrice(unit_price, unit)` (unit_price уже ex-VAT); `vat_rate` из OCR/редактирования.

### Списания (stock_writeoffs)

- Причины (`reason`): `waste`, `spoilage`, `tasting`, `staff_meal`, `other`.
- `createWriteoff` (`inventory/writeoffs/actions.ts`, только **service role**): вставка `stock_writeoffs` с **`brand_id: null`**, строк `stock_writeoff_items` с `cost_per_unit` из текущего `avg_cost`, уменьшение `ingredient_stock.quantity`, запись `stock_ledger` (`writeoff`, отрицательный `quantity_delta`).
- `total_cost` — generated по строкам.

### Инвентаризации (stock_audits)

- `createAudit` (`audits/actions.ts`): вставка `stock_audits` с `brand_id` из `getAdminBrandId()` (исключение для склада); строки `stock_audit_items` с ожиданием из остатка, `actual_qty: null`.
- Подтверждение (`audits/[id]/actions.ts`, service role): обновление остатков, `stock_ledger` (`audit_adjustment`), заполнение `cost_per_unit` и `diff_cost` в строках.
- `stock_audit_items.diff` — generated.

### Техкарты (product_recipes)

- `quantity` — нетто; `quantity_gross` — брутто.
- Объём списания и себестоимость строки с `ingredient_id` — через `recipeIngredientStockStorageQty` (`product-recipe-ingredient-qty.ts`) = `COALESCE(quantity_gross, quantity)`.
- **Комбо (вложенное блюдо):** `menu_item_ref_id` + `menu_item_ref_variant_id` (NULL если у целевого блюда нет вариантов). При ссылке: `quantity=1`, `ingredient_id`/`semi_finished_id` = NULL. CHECK в миграции.
- **Embed полуфабрикатов:** при nested select `semi_finished_items(...)` указывать FK-hint `semi_finished_items!semi_finished_items_semi_finished_id_fkey(...)` (страница `/admin/inventory/semi-finished`, `RecipeEditorModal` → `product_recipes`). Для вложенного п/ф в составе — `semi_finished_ref_id` (FK на `semi_finished`), `ingredient_id` = NULL; для ингредиента — наоборот.
- `ingredients.waste_percent` (0–100): в техкарте нетто = брутто × (1 − %/100).
- `product_recipe_meta`: `output_qty`, `output_unit` (уникальность по `menu_item_id` + `variant_id`).
- **Себестоимость рецепта (админка):** единый хелпер `src/lib/product-recipe-cost.ts` — `productRecipeLineCostMdl` (ингредиент × gross × `avg_cost`; п/ф × gross × `semiCostPerStorageUnitMdl`; комбо → `computeReferencedMenuItemRecipeCostMdl` по рецепту referenced блюда). Контекст: `buildProductRecipeCostContext` + `enrichProductRecipeCostContext` (карты цен ингредиентов/п/ф, индекс `product_recipes` по `menu_item_id`, `has_sizes` для выбора варианта комбо). Агрегация для списка меню — `buildMenuItemRecipeCostMap` (base-рецепт или min по вариантам). Используется в `/admin/menu/page.tsx` (рядом с бейджем «✓ Рецепт») и `RecipeEditorModal` (строки + итог; превью комбо — `computeMaterialRecipeCostMdl`). П/ф — через `semi-finished-cost.ts`; вложенные комбо **внутри** referenced рецепта не суммируются (как в превью модалки).
- Расчёт суммарного списания по заказу: `src/lib/order-recipe-stock-deduction.ts` (`computeIngredientTotalsForOrder`). Вложенные комбо разворачиваются на **одну ступень**.
- **Списание ингредиентов в `payOrder` пока не подключено.**

### Полуфабрикаты (`semi_finished`, `semi_finished_items`)

- `semi_finished`: `name`, `yield_qty`, `yield_unit` (г/мл/шт в БД), `brand_id`.
- `semi_finished_items`: `semi_finished_id`, `quantity` (ед. хранения), **`ingredient_id`** XOR **`semi_finished_ref_id`** (вложенный п/ф; без рекурсии на себя в UI).
- Себестоимость п/ф: сумма входа по строкам (`qty × ingredient_stock.avg_cost` для ингредиентов; для вложенного п/ф — `qty × cost_per_yield_unit` вложенного). Реализация — `src/lib/semi-finished-cost.ts`.
- UI: `/admin/inventory/semi-finished` — список с колонкой себестоимости; диалог — тип строки, combobox, live-расчёт «Себестоимость п/ф» / «Себестоимость / {ед. выхода}». Цены для расчёта передаются с сервера (`ingredient_stock(avg_cost)`), не дублировать клиентский fetch с `brand_id` (склад общий).

### Топпинги

- `topping_groups.max_selections`: NULL = без лимита; число ≥1 — **сумма `quantity` по группе** в одной строке корзины/заказа.
- `menu_item_topping_groups.free_count` (integer, default 0): сколько **единиц** топпингов из группы бесплатны для конкретной позиции меню. Стратегия цены — **самые дёшевые единицы бесплатны первыми** (`calcToppingGroupCharge` в `src/lib/topping-pricing.ts`). `0` = все платные.

**Витрина — модель корзины** (`src/types/cart.ts`):
- `CartTopping`: `id`, `name_ru/ro`, `price` (bani/шт), `quantity`, `topping_group_id`.
- `CartItem`: `cartToppings[]`, `toppingGroupFreeCounts` (Record groupId → free_count), `toppingGroupLabels` (имена групп для UI корзины), legacy `selectedToppingIds` (синхронизируется из `cartToppings` через `syncCartItemToppingFields`).
- Store: `addTopping` / `removeTopping` (`cart-store.ts`); лимит группы — `getTotalQuantityInGroup` (`cart-toppings.ts`). Синтетический `Topping` в `toppingsList` при add — с `aggregator_price_bani: null`.
- Цена строки: `getCartItemPrice` → `calcToppingGroupCharge` по группам (`cart-helpers.ts`); legacy persist без `cartToppings` — `migrateCartToppingsFromLegacy`.

**Витрина — модалка товара** (`ProductModalRoot`, `ToppingCard` → `ToppingStepperCard`):
- Сетка карточек топпингов `grid-cols-3`; заголовок группы — «выбрано N из M» + текст бесплатных единиц (`formatStorefrontToppingGroupHeader`, `getFreeUnitsRemaining`).
- Карточка: белый фон, border `#f2f2f2`; при `quantity > 0` — accent-рамка. **Клик по всей карточке** добавляет единицу; убрать — только кнопкой «−».
- При `freeUnitsRemaining > 0` — зелёная метка «Бесплатно»; итог кнопки «В корзину» — через `calcToppingGroupCharge` по `StorefrontMenuItemToppingGroup.free_count`.
- При добавлении в корзину передаются `toppingGroupFreeCounts` и `toppingGroupLabels` из секций модалки.

**POS — модалка позиции** (`pos-product-modal.tsx`, тот же `ToppingStepperCard`, `variant="pos"`):
- Сетка `grid-cols-4`; загрузка групп с `free_count` из `menu_item_topping_groups` и `aggregator_price_bani` у топпингов.
- Проп `isAggregator` — расчёт unit price и payload корзины с агрегаторными ценами.
- Та же UX-модель: tap по карточке = add, «−» = remove one; лимит группы по сумме `quantity`.
- В payload корзины: `toppings: PosCartTopping[]`, `toppingGroupFreeCounts`, `aggregatorUnitPriceBani` из варианта/позиции, unit price через `calcPosToppingsCharge` / `getPosCartItemUnitPriceBani`.

**POS — корзина в мастере** (`order-form.tsx`, `CartItemRow`):
- Строки топпингов: `+ Название ×N`; бесплатные — зелёным, платные — серым (`getPosCartItemToppingDisplayLines` + `calcToppingChargesById`).
- Merge одинаковых конфигураций — `posCartToppingsConfigKey`; fingerprint корзины учитывает `id:quantity`.

**Общий UI топпингов** (`src/components/topping-stepper-card.tsx`):
- Карточка 64px image, name, price label, stepper (или только «+» при `quantity=0`).
- Варианты `storefront` / `pos` — различаются accent-рамкой при выборе и фоном stepper.

**Админка — привязка групп к позиции** (`menu-item-dialog.tsx`):
- Чекбокс группы + поле «Бесплатных единиц» (min 0); helper: «0 = все платные».
- Бейдж «N бесплатно» у прикреплённой группы при `free_count > 0`.
- Поле **Glovo** (`aggregator_price_bani`) рядом с ценой: для позиции без размеров — на уровне `menu_items`; для `has_sizes` — в каждой строке варианта (`menu_item_variants`). Nullable, в UI — MDL.
- Поле **`discount_percent` в UI убрано** (миграция на `/admin/discount-rules`); при сохранении всегда пишется **`null`** (legacy значения в БД остаются для старых заказов / `calcCompareAt` на витрине).
- Actions: `getMenuItemToppingGroups` / `setMenuItemToppingGroups` (`MenuItemToppingGroupAttachment`: `topping_group_id`, `free_count`).

**Витрина — корзина / checkout** (`CartItemToppingDetails`, `CartItemCard`, `order-summary`):
- Топпинги по группам: строки `«Название ×N — X лей»`; charge per topping — `calcToppingChargesById`.
- Если вся группа бесплатна — зелёный бейдж «В комбо» у названия группы.
- **`CartItemCard`:** per-item `item_percent` / legacy `discount_percent` — зачёркнутая оригинальная цена + цена со скидкой; при `giftFreeUnits > 0` — дополнительно зачёркнутая бесплатная часть + «0 лей» зелёным и сумма за платные единицы.

**Прочее:**
- `topping-max-selection.ts` — legacy-хелпер `nextSelectedToppingIdsWithGroupCap` (витрина, flat ids); POS больше не использует `nextSelectedByGroupWithCap`.
- `topping_recipes` — состав топпинга. RPC `save_topping_with_recipes` (параметр `p_aggregator_price_bani`; миграция `*_toppings_aggregator_price_rpc.sql`).
- Сопоставление snapshot топпинга в заказе с `topping_recipes` — `lib/topping-recipe-match.ts` (`orderItemToppingMatchesRecipeRow`, `findToppingRecipeRowForOrderItem`): сначала по `order_items.toppings[].id`, иначе по `name` ↔ `toppings.name_ru` / `name_ro` (legacy и заказы без `id`).
- В `/admin/toppings` — поле «Цена агрегатор (MDL)» в `topping-dialog.tsx`; действие «Существующий» — **копирует** топпинг в новую группу вместе со строками `topping_recipes`. Дубликаты по `name_ru`/`name_ro`/`price` в группе блокируются.
- `parseOrderItemToppings` (`components/pos/kds/types.ts`) пробрасывает `id` из JSONB; `migratePosCartToppingsFromLegacy` при загрузке заказа в POS читает `raw.id`.

## Витрина

### i18n

- Языки: `ru`, `ro`. **DEFAULT_LANG = `ro`** (`src/lib/i18n/storefront.ts`).
- persist key `lang` в localStorage. `<html lang="ro">` по умолчанию; `ClientChrome` синхронизирует `document.documentElement.lang` при смене.
- Legacy-пути `/ru/*` и `/ro/*` на production редиректятся на корень (`vercel.json`, 301).
- Динамические названия — `pickLocalizedName`, `pickLocalizedDescription`.
- Server action `createOrder` принимает язык для snapshot заказа и текстов ошибок.

### Maintenance mode

Флаг `MAINTENANCE_MODE` в `src/app/(client)/layout.tsx`. При `true` рендерится только `MaintenanceScreen` + `AuthInitializer` + `MetaPixel` (без `StoreClosedModal` и `ClientChrome`). **`/admin` и `/pos` не используют этот гейт.**

### Модалка «магазин закрыт»

Глобальный оверлей вне часов приёма заказов на витрине (не POS, не админка).

| Файл | Роль |
|---|---|
| `src/lib/store-hours.ts` | `isStoreOpenAt`, `getMinutesUntilStoreOpen`, `getChisinauMinutes` (Europe/Chisinau) |
| `src/hooks/use-store-open.ts` | `useStoreOpen(brandSlug?)` → `{ isOpen, hours, minutes, mounted, openTimeLabel }` из `BrandConfig.openHour` / `closeHour` |
| `src/lib/store/store-closed-store.ts` | `dismissed`, `showStoreClosedModal()` — повторный показ после «Понятно» |
| `src/components/store-closed-modal.tsx` | UI: RU/RO; текст открытия — `openTimeLabel` (11:00 / 15:00 и т.д.) |

**Часы по бренду (`src/brands/index.ts`, ночная смена `closeHour ≤ openHour`):**

| Бренд | Открыто (Chisinau) |
|---|---|
| `kitch-pizza`, `the-spot` | 11:00 – 03:00 |
| `losos` | 15:00 – 03:00 |

Пересчёт каждые **30 с**; до `mounted` — `isOpen: true` (без hydration mismatch). POS-слоты предзаказа — те же `openHour`/`closeHour` (`scheduled-slots.ts`).

**Подключение:** `<StoreClosedModal brandSlug={…} />` в `(client)/layout.tsx`.

**Поведение UI:** полноэкранный `fixed` оверлей `z-50`. Закрытие кнопкой «Понятно :(» / «Am înțeles :(»; backdrop не закрывает. При `isOpen === true` — `dismissed` сбрасывается.

**Guards при `!isOpen`:** не открывают корзину/модалку товара, но вызывают `showStoreClosedModal()`:

- `menu-category-bar.tsx` — корзина
- `menu-item-card.tsx`, `featured-menu-section.tsx` — карточка товара; цены через `getItemCampaignDiscount` + rules из контекста
- `ProductModalRoot.tsx` — «В корзину»; на кнопке — зачёркнутая сумма без кампании + итог с учётом `item_percent` на базу (топпинги без изменений)
- `checkout-view.tsx` — `handleBackNav` + корзина

### Layout и SEO

- `(client)/layout.tsx`: `StoreClosedModal`, **`WelcomeBonusModal`**, **`Toaster`** (Sonner, checkout errors), `generateMetadata`, `BrandJsonLd`, `MetaPixel`, `StorefrontTopBar`, `ClientChrome` (+ `itemPercentCampaignRules` → `StorefrontCampaignRulesProvider`); резолв бренда по `x-brand-slug`.
- `(client)/page.tsx`: `generateMetadata`, `<h1 className="sr-only">` по бренду.
- `BrandJsonLd` в `components/seo/JsonLd.tsx` — JSON-LD `Restaurant` + `FoodDelivery`.
- SEO: `src/lib/seo/brand-seo.ts` (`BRAND_SEO`, `getBrandSeo`, canonical `kitch.md`/`losos.md`/`thespot.md`).
- `robots.ts`: allow `/`, disallow `/admin/`, `/pos/`, `/api/`.
- `sitemap.ts`: brand-aware по `x-brand-slug`.

### Корзина и checkout

- Адрес доставки с витрины → **одна строка** `orders.delivery_address`. Структурные `address_*` не заполняются.
- **Checkout:** `checkout-view.tsx` ждёт гидратацию корзины через `usePersistStoreHydration(useCartStore.persist)` — при сбое rehydrate UI не блокируется навсегда (скелетон снимается в `finally`).
- POS при открытии мастера разрезает через `posCheckoutAddressFieldsFromOrder` (`split-composite-delivery-address.ts`) если все четыре поля пусты. Извлекает Scara / Etaj / Apartament / Interfon (плюс RU/EN аналоги: подъезд/этаж/квартира/домофон, entrance/floor/apartment/intercom). Если хоть одно поле уже заполнено — строка не режется.
- Точка самовывоза bd. Dacia 27: `storefront-pickup-location.ts`.
- Меню для апсейла LOSOS использует `menu_categories.show_in_upsell`.
- Storefront-разработка: использовать `storefront-modal-*`, `storefront-checkout-*`, `storefront-input` вместо локальных цветов.
- Доставка: `delivery-store` + `getStorefrontDeliveryLineDisplay` (`storefront-delivery-display.ts`); fee из `getDeliveryFeeBani` → `selectedZone.resolvedParams`. Модалка адреса — `DeliveryRoot` / `getActiveDeliveryZones` (зоны уже отфильтрованы по `isZoneAvailableNow`).
- Корзина: `cart-store` (`CART_STORAGE_KEY` = `kitch-cart` в persist; брендовые ключи в `BrandConfig.cartKey` / `deliveryKey` — см. TODO). `cartToppings` + legacy `selectedToppingIds` синхронизируются при записи; `toppingGroupFreeCounts` / `toppingGroupLabels` — snapshot при добавлении из модалки. Детали топпингов в UI — `CartItemToppingDetails`.
- **Pricing checkout:** `checkout-view.tsx` → `useCheckoutPricing` → `POST /api/[brandSlug]/checkout/pricing` при изменении корзины, промокода, бонусов, доставки. `OrderSummary` показывает breakdown: сумма без скидок → скидка на сеты → промокод → бонусы → доставка → итого. Submit блокируется до ответа pricing.
- **Способы оплаты checkout (`checkout-view.tsx`):** всегда видны **наличные** (`cash`) и **«Картой курьеру»** (`card`, i18n `t.checkout.card` — терминал у курьера, без редиректа). **`online_card`** (Card online / Apple Pay / Google Pay → MAIB) — **только** при `NEXT_PUBLIC_CARD_PAYMENT_ENABLED=true`; иначе кнопка скрыта, а выбранный `online_card` сбрасывается на `cash` (`card` не затрагивается). Сервер: `CARD_PAYMENT_ENABLED=true` для `POST /api/[brandSlug]/checkout/pay`, иначе **503**. После успешного `createOrder` с `online_card` → `POST /api/[brandSlug]/checkout/pay` `{ orderId }` → `{ payUrl }` → `window.location.href` (корзина очищается перед редиректом). Ошибка pay API — `toast` (Sonner в `(client)/layout.tsx`), корзина не сбрасывается. Редиректы MAIB: **`/payment/success`**, **`/payment/fail`** (`?orderId=&payId=`). Кнопки оплаты: неактивные — белый фон; активная — `var(--color-accent)` + `var(--color-accent-text)` (чёрный текст на Kitch, белый на Losos/The Spot).
- **Списание бонусов в checkout:** `BonusRedeemBlock` — числовой ввод MDL, «Макс. списание бонусами: X MDL» из API; disabled при промокоде или `pricing.active_promotion` (разные tooltip RU/RO). Баланс и лимиты — из `PricingResult`, не отдельные fetch.
- Вне часов работы бренда — см. **«Модалка „магазин закрыт"»**.

### /account

Клиентская страница, guard через `GET /api/auth/me` с `credentials:'include'`. Без профиля — `router.replace('/')`, UI пустой до успеха.

Секции:
- Бонусы: `GET /api/bonus/balance?profileId=`.
- Последние 10 заказов: `GET /api/account/orders`.
- Профиль: `PATCH /api/account/profile` (`{ name }`), телефон read-only.
- Аватар: `GET /api/avatar/{profileId}` (SVG DiceBear thumbs, `Cache-Control: public, max-age=31536000`).
- Выход: `POST /api/auth/logout` + `clearProfile()`.

URL аккаунта по бренду: `storefront-account-path.ts` (`/account`, `/losos/account`, `/thespot/account`).

### AuthModal и WelcomeBonusModal

`AuthModal` — Vaul при ширине ≤1023px, shadcn Dialog на десктопе. Тексты — `t.auth.modal`. Управление — `auth-store` (`openAuth(onAuthSuccess?)`, `closeAuth`, `dismissAuth`, `fetchMe`, **`welcomeBonusPending`**, **`setWelcomeBonusPending`**). После успешного OTP: `fetchMe()` → `closeAuth()` → если `response.welcomeBonus === true` — `setWelcomeBonusPending(true)`.

`WelcomeBonusModal` — поздравление с welcome-бонусом (+100 pts, LOSOS); RU/RO из `language-store`; закрытие сбрасывает `welcomeBonusPending`.

### Leaflet

Компоненты с `leaflet`/`react-leaflet` подключать **только client-side** через `dynamic(..., { ssr: false })`. **Не вызывать `import('react')` внутри фабрики `dynamic`** (ломает Turbopack/HMR). Не реэкспортировать карту из barrel-файлов.

### Отзывы после заказа (feedback)

**Цель:** SMS с просьбой оценить заказ через 1–48 ч после `orders.status=done` (не aggregator).

| Слой | Путь / файл |
|---|---|
| Cron | `GET /api/cron/feedback-sms` — **GitHub Actions** `.github/workflows/feedback-sms-cron.yml` (`*/10 * * * *`); auth: `CRON_SECRET` (Bearer). На Vercel Hobby **нельзя** cron чаще 1×/сутки в `vercel.json` (ошибка `vercel.link/3Fpeeb1`). В `development` cron-route без проверки секрета |
| SMS | `lib/sms.ts` → `sendSms({ to, text, brandSlug? })`; GET `https://api.sms.md/v1/send` (`from`, `to`, `message`, `token`); sender = `BrandConfig.smsSender` или `SMS_MD_SENDER` / `FoodService` |
| Текст SMS | `getFeedbackSmsText` (RO): «Va multumim… 30 de secunde…» + `https://{domain}/f/{short_code}` |
| Короткая ссылка | `https://{domain}/f/{short_code}` (dev: `http://localhost:3000/{brandSlug}/f/…`) |
| Прямая ссылка | `/feedback/{token}` — UUID |
| Публичная форма | `FeedbackForm` — RO/RU, заголовок + подзаголовок, звёзды 1–5, комментарий, **до 3 фото** (JPEG/PNG/WebP, ≤5 MB) |
| Загрузка фото | `POST /api/feedback/{token}/upload` → bucket `feedback-photos` (`{order_id}/{ts}-{rand}.ext`); пути в `photo_urls` при submit |
| Просмотр фото (админ) | `GET /api/feedback/{token}/photo/[...path]` — `getAdminSession`, signed URL 1 ч, redirect |
| Негатив | `isNegativeFeedback` (любая оценка ≤4) → `sendNegativeFeedbackTelegram` (+ фото в Telegram) |
| Админка | `/admin/feedback` — метрики, таблица, Sheet (фото клиента), резолюция → `PATCH /api/admin/feedback/{id}/resolve` |

**Таблица `order_feedback`** (тип `OrderFeedback` в `src/types/database.ts`; в remote может отсутствовать в сгенерированных types — `as any`):

| Поле | Назначение |
|---|---|
| `order_id`, `brand_id` | FK заказа и бренда |
| `token` | UUID для API и прямой ссылки |
| `short_code` | 8 символов `0-9a-z` для SMS URL |
| `token_expires_at` | срок ссылки (cron: +72 ч) |
| `sms_sent_at` | момент отправки SMS |
| `food_rating`, `service_rating`, `comment`, `photo_urls`, `submitted_at` | ответ клиента (`photo_urls` — массив путей в Storage) |
| `resolution_note`, `resolved_by`, `resolved_at` | резолюция в админке (негативные) |
| `tg_message_id`, `tg_notified` | Telegram при негативе |

**Storage:** bucket `feedback-photos` (private); публичного URL нет — только signed URL для админа/Telegram.

**Cron-логика:** заказы `done`, не `aggregator`, `done_at` 1–48 ч назад, есть `profiles.phone`, нет строки `order_feedback` по `order_id`; cooldown 3 ч на профиль+бренд; insert + SMS; при ошибке SMS — rollback insert.

**Публичные страницы:** без shell витрины; корень `data-brand={slug}` + `data-theme="light"`; логотип бренда в форме (`brand.logo` из `getBrandBySlug`, как в `main-header.tsx`); цвета — CSS-переменные `[data-brand]` в `globals.css`.

## Админка

### Layout

`AdminShell`: `TooltipProvider` + `SidebarProvider` → `AdminSidebar` (`collapsible="offcanvas"`, `variant="inset"`) + `SidebarInset`.

Активный бренд: cookie `admin-brand-slug` → `getAdminBrandId()` для брендового контента.

Корень `/admin` → `redirect('/admin/orders')`.

`AdminSidebar`: первый пункт навигации — **Аналитика** (`/admin/analytics`). Группа **«Маркетинг»**: «Галерея», **«Кампании»** (`/admin/discount-rules`, подпись Campanii), «Промокоды», программа лояльности.

`/admin/*` без сессии → редирект на `/admin/login`. `/api/admin/*` без сессии → 401 JSON.

Независимые запросы — `Promise.all`.

### Разделы

| Маршрут | Описание |
|---|---|
| `/admin/analytics` | Дашборд KPI и графики: `getAnalyticsData` (`lib/actions/admin/analytics.ts`), `AnalyticsDashboard` (recharts). Фильтры: период 7/14/30 дней, бренд или все. Заказы `status=done`, выручка в MDL (bani/100). **PostgREST-лимит 1000 строк:** выборки `orders` и `profiles` за период — через `fetchAllRows` (`.range`, PAGE=1000, как в `orders-today-metrics`); `order_items` для топа позиций — батчи по 300 `order_id`. Summary и dayStats считаются по полному набору строк. |
| `/admin/orders` | Метрики за сутки UTC (`getAdminOrdersTodayMetrics`, пагинация PAGE=1000) + фильтры (`status_group`, `brand_id`, `order_src`, `search`, даты — дефолт сегодня UTC) + таблица. Клик по строке → `OrderDetailSheet` через `fetchAdminOrderDetail` (service role). |
| `/admin/customers` | RSC `page.tsx` + **`CustomersPageClient`**: RPC **`get_customers_list`** (50/стр.), URL `?search=`, `?page=`. Фильтры в Popover (`customers-filters.tsx`, sort: `created_at` / `orders_count` / `total_spent` / `last_order_at` / `bonus_balance` / `name`). Таблица: заказы из `orders` (done) + Poster tooltip, LTV в bani, последний заказ → `/admin/customers/[id]`. |
| `/admin/feedback` | RSC + **`FeedbackPageClient`**: `fetchFeedbackPageData` (`lib/actions/admin/feedback.ts`) — метрики (avg, конверсия SMS→отзыв, негатив %), до 100 отзывов с join `brands`, `orders` → `profiles`, `courier:staff!orders_courier_id_fkey`. URL: `?from=`, `?to=`, `?brand=`. Фильтры на клиенте: негатив/позитив, ждёт решения/решено. Sheet: комментарий, **фото от клиента** (thumbnails через `/api/feedback/{token}/photo/…`), резолюция → `PATCH /api/admin/feedback/{id}/resolve`. Sidebar: **Отзывы** после «Клиенты». |
| `/admin/customers/[id]` | RSC: профиль, баланс через **`getActualBalance`**, до 50 транзакций, до 20 заказов. `BonusAdjustForm` → `POST /api/admin/bonus/adjust` (тоже `getActualBalance` для `balance_after`). |
| `/admin/settings/bonus` | `bonus_settings` id=1; `updateBonusSettings` (`%` в UI → доли в БД). |
| `/admin/categories` | `menu_categories`: RU/RO, slug, `image_url`, `show_in_upsell`, `exclude_from_discounts`, `workshop`. |
| `/admin/menu` | `menu_items` + `menu_item_variants` (+ `aggregator_price_bani`). Привязка групп топпингов с `free_count` (`menu-item-dialog.tsx`; **без UI `discount_percent`** — скидки на товары через **Кампании**). `RecipeEditorModal` (типы строк: ингредиент, п/ф, комбо; себестоимость — `product-recipe-cost.ts`; embed п/ф — FK-hint `semi_finished_items!semi_finished_items_semi_finished_id_fkey`). `?edit={id}` автооткрытие. Бейджи покрытия рецептом + **себестоимость рецепта** (MDL) из `buildMenuItemRecipeCostMap` на сервере. |
| `/admin/featured-menu` | «Популярное». |
| `/admin/toppings` | Группы + топпинги (`aggregator_price_bani`); копирование между группами; состав через `topping_recipes` (RPC `save_topping_with_recipes`). |
| `/admin/promotions` | Промо-баннеры RU/RO. |
| `/admin/discount-rules` | **Кампании** (`PromotionsClient`, sidebar «Кампании» / Campanii). `discount_rules` (все бренды в списке, без `getAdminBrandId()`). Редактор `rule-dialog.tsx` + `rule-search-comboboxes.tsx`: `item_percent` — multi-select товаров по категориям (`target_item_ids`, `ItemPercentTargetPicker`); `cheapest_item_free` — `free_every_n` + multi-select категорий (`target_category_ids`, `CategoryTargetPicker`); `valid_from` / `valid_until`. Список: для `item_percent` — бейджи «X% скидка», «N товаров», период / «бессрочно». Actions: `saveRule`, `deleteRule`, `toggleRuleActive`, `fetchTargetMenuItemsForDiscountRule`, `fetchCategoriesForDiscountRule` (service role). |
| `/admin/promo-codes` | `promo_codes`. |
| `/admin/staff` | `staff` + PIN (`bcryptjs`); deep-link Telegram для курьеров. Service role. |
| `/admin/staff/shifts` | `shift_logs` + join `staff` + подсчёт доставленных (`orders.status=done`, `courier_id`, `delivered_at` в интервале). |
| `/admin/delivery-zones` | `delivery_zones` + nested `delivery_zone_schedules`: полигоны Leaflet Draw, color, базовая цена/минималка/время, слоты расписания в редакторе. Actions: `createDeliveryZone`, `updateDeliveryZone`, `deleteDeliveryZone`; слоты — `createSchedule`, `updateSchedule`, `deleteSchedule`. |
| `/admin/finances` | Главный P&L-дэшборд: Server Component `page.tsx` + client `PnLDashboard`; gross/net revenue, каналы выручки, комиссии, P&L breakdown, предупреждения по отсутствующему факту Glovo/банка. Период через общий `PeriodFilter` (Popover). |
| `/admin/finances/glovo` | Журнал выплат Glovo: Server Component `page.tsx` + client `GlovoClient`; summary-карточки gross / расчётной комиссии / факта / расхождения, таблица settlements, Sheet-форма добавления и удаление через `deleteGlovoSettlement`. Период через общий `PeriodFilter` (Popover). |
| `/admin/finances/expenses` | Журнал внекассовых расходов: Server Component `page.tsx` + client `ExpensesClient`; summary-карточки по группам, таблица и удаление, Sheet-форма добавления через `createExpense`; суммы в UI — MDL, в БД — bani. Период через общий `PeriodFilter` (Popover). |
| `/admin/finance/cash-sessions` | Список смен (фильтры даты/staff/status, до 200; агрегаты по `cash_transactions` + Glovo card из `orders`). |
| `/admin/finance/cash-sessions/[id]` | Деталь: `getCashSessionDetail` + `CashSessionDetailView`; таблица транзакций с void/edit для allowlist-пользователей (`cash-transaction-actions.tsx`); бейдж «Аннулировано», иконка редактирования при `edited_at`. |
| `/admin/finance/ledger` | `stock_ledger`, до 200 последних; фильтр по `movement_type` на клиенте; service role. |
| `/admin/inventory/stock` | Остатки (read-only); фильтр «Все/В наличии/Нет» на клиенте; единицы кг/л/шт. |
| `/admin/inventory/suppliers` | Поставщики (CRUD без бренда; удаление с проверкой `supply_orders`). |
| `/admin/inventory/ingredient-categories` | `ingredient_categories`; при удалении категории — `category_id=NULL` у связанных ингредиентов. |
| `/admin/inventory/ingredients` | `ingredients` + `ingredient_stock`. Фильтр категории: клиент при <500 строк (`INGREDIENT_SERVER_FILTER_THRESHOLD`), сервер при ≥500 (`?category=`). Поле `waste_percent`. |
| `/admin/inventory/semi-finished` | Полуфабрикаты (`semi-finished-dialog.tsx`, `semi-finished-table.tsx`). Embed: `semi_finished_items!…(*, ingredients(name, unit, ingredient_stock(avg_cost)), semi_finished_ref:semi_finished!semi_finished_items_semi_finished_ref_id_fkey(name, yield_unit))`. Состав: строка **ингредиент** или **вложенный п/ф** (`semi_finished_ref_id`; текущий п/ф в списке выбора исключается). Себестоимость — `computeSemiInputCostMdl` (`lib/semi-finished-cost.ts`) по `ingredient_stock.avg_cost` (общая карта цен с страницы, без фильтра по бренду). В таблице: колонки «Себест.», «Состав» (`truncate` + `title`). В диалоге: combobox с поиском (`IngredientCombobox`, `SemiFinishedCombobox` → `InventorySearchCombobox`). Редактор в г/мл/шт. |
| `/admin/inventory/tech-cards` | Read-only обзор себестоимости. Ссылка «Открыть в меню» → `/admin/menu?edit={id}`. |
| `/admin/inventory/supplies` | Поставки: RSC `page.tsx` + `types.ts` (`SupplyOrderViewModel`, `SupplyPeriodTotals`); **`PeriodFilter`** + итоги за период; **`InvoiceOcrModal`** («Из фото» → `POST /api/admin/inventory/ocr-invoice` → `createSupplyOrder`); ручная модалка (`create` / `edit` / `view`) с двусторонним расчётом цен/итогов, `IngredientCombobox`; **редактирование** активных (`updateSupplyOrder`), просмотр аннулированных, аннулирование (`annulSupplyOrder` → RPC `annul_supply_order_stock`). |
| `/admin/inventory/writeoffs` (+ `/new`) | Списания; выбор ингредиента — `IngredientCombobox`. |
| `/admin/inventory/audits` (+ `/[id]`) | Инвентаризации (создание + карточка с подтверждением). |

Единое поле поиска для всех inventory-таблиц — `InventorySearch` (`src/components/admin/inventory-search.tsx`); клиентский фильтр поверх данных, **кроме** фильтра категории на `/admin/inventory/ingredients` при ≥500 строк (сервер).

**Combobox выбора ингредиента / п/ф** (длинные списки): `src/app/(admin)/admin/inventory/inventory-search-combobox.tsx` (Command + Popover, фильтр `contains` без учёта регистра). Обёртки: `supplies/ingredient-combobox.tsx`, `semi-finished-combobox.tsx`. Техкарты в меню — `RecipeNameCombobox` (`components/admin/menu/RecipeNameCombobox.tsx`). Короткие Select (категории, единицы, причины списания) — без замены.

## Данные и БД

### Брендовое и общее

См. раздел «Multi-brand: что брендовое, что общее».

### Основные таблицы

- `brands` — slug, name, UUID.
- `menu_categories` — `name_ru/ro`, slug, `image_url`, `is_active`, `sort_order`, `is_condiment` (legacy), `show_in_upsell`, `exclude_from_discounts`, `workshop` (KDS-фильтр).
- `menu_items` — `has_sizes` (true → цены из variants), `included_items` (JSON `{name_ru,name_ro}[]`), `category_id`, `brand_id`, `aggregator_price_bani` (nullable bani). Legacy: `discount_percent` (только чтение на витрине; новые сохранения — `null`), `is_default_condiment`, `condiment_default_qty` (не используются).
- `menu_item_variants` — `name_ru/ro`, `price` (bani), `aggregator_price_bani` (nullable bani), `sort_order`, `weight_grams`, `menu_item_id`.
- `topping_groups` (`max_selections` NULL/число), `toppings` (`aggregator_price_bani`), `topping_recipes`, `menu_item_topping_groups` (`menu_item_id`, `topping_group_id`, `free_count`).
- `promotions`, `featured_menu_items`, `promo_codes` (с `valid_channels`), `discount_rules` (`effect_type`, `effect_value`, `target_item_ids[]`, `target_category_ids[]`, `free_every_n`, `trigger_type`, `valid_from` / `valid_until`, `priority`, `brand_id`).
- `delivery_zones` — `polygon` JSONB `[lat,lng][]`, `color` (TEXT, HEX), `delivery_price_bani`, `night_delivery_price_bani`, `active_from`, `active_to`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `is_active`, `sort_order`, `brand_id`.
- `delivery_zone_schedules` — `zone_id`, `from_time`, `to_time`, `delivery_price_bani`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `sort_order` (миграции `*_delivery_zone_schedules.sql`, `*_delivery_zones_night_and_window.sql` для legacy-колонок зоны).
- `orders`, `order_items` — см. раздел Контракты.
- `profiles`, `otp_codes`, `customer_addresses` (`profile_id`, `label`, `address`, `entrance/floor/apartment/intercom`, `delivery_lat/lng`, `is_default`). На `profiles`: **`poster_orders_count`**, **`poster_last_order_at`** (история Kitch/Poster для списка клиентов).
- **`order_feedback`** — отзывы после заказа (см. раздел «Отзывы после заказа»); брендовая привязка через `brand_id`.
- `bonus_settings`, `bonus_transactions`.
- `staff`, `shift_logs`, `courier_locations`.
- `cash_sessions`, `cash_transactions` (`expense_category_id` → `expense_categories`, legacy `category` остаётся для совместимости).
- Финансы: `expense_categories` (`variable` / `fixed` / `operational` / `commission`), `expenses` (внекассовые расходы, суммы в bani), `glovo_settlements`, `finance_settings` (single-row id=1).
- `pbx_calls` (ОАТС), `incoming_calls` (legacy MoldCell).
- Склад: `ingredient_categories`, `ingredients`, `ingredient_stock`, `stock_ledger`, `semi_finished`, `semi_finished_items` (`ingredient_id` **или** `semi_finished_ref_id` на строку состава), `product_recipes`, `product_recipe_meta`, `suppliers`, `supply_orders` (`annulled_at`), `supply_order_items`, `stock_writeoffs`, `stock_writeoff_items`, `stock_audits`, `stock_audit_items`.

### Типы

`src/types/database.ts` — `OrderStatus`, `Order`, `OrderItem`, `OrderItemTopping` (`toppings` JSONB: `id?`, `name`, `price`, `quantity`), `MenuItem` / `MenuItemVariant` / `Topping` (`aggregator_price_bani?`), `MenuItemToppingGroup` (`free_count`), **`CustomerAddress`** (сохранённые адреса клиента для POS/API), `CashSession`, …

`src/types/customers.ts` — `CustomerRow` (`orders_count`, `total_spent_bani` как **string** из bigint RPC; `last_order_at`, legacy Poster-поля, `bonus_balance`), `CustomerFilters`, `DEFAULT_CUSTOMER_FILTERS`.

`src/types/promotions.ts` — `DiscountRule` incl. **`target_item_ids?`**, **`target_category_ids?`**, **`max_free_items?`**, `GiftCartItem`, `DiscountEngineOutput.giftItems`.

`src/types/cart.ts` — `CartItem`, `CartTopping` (`quantity`, `topping_group_id`), `toppingGroupFreeCounts`, `toppingGroupLabels`.

`src/types/pos.ts` — `PosOrder` incl. **`subtotal?`, `item_discount?`, `promo_discount?`**; `PosCartItem` (`aggregatorUnitPriceBani?`), `PosCartTopping` (`aggregator_price_bani?`, та же форма что `CartTopping` + `toppingGroupFreeCounts` на строке корзины POS).

`src/types/finance.ts` — `ExpenseCategory`, `Expense`, `GlovoSettlement`, `FinanceSettings`, `PnLData`.

`src/lib/supabase/types.ts` — частично генерированный Database (минимальные наброски). Перегенерировать через `supabase gen types` при появлении новых миграций.

### Realtime

Publication `supabase_realtime` обязательна для `orders`, `order_items`, `pbx_calls`. RLS должна разрешать чтение нужных строк ролью, которой подписывается клиент (иначе события скроются):
- `pbx_calls`: SELECT для `anon` на `cmd ∈ ('contact','event')`. Связанное чтение `profiles.name`.
- `brands` для anon на чтение `id`, `slug` (иначе join и фолбек по `brand_id` вернут пусто).

### Service role

Обход RLS — `src/lib/supabase/service-role.ts` (`createServiceRoleClient` = `createServiceSupabaseClient`). Использовать для server actions, где нужен полный доступ.

### Загрузка изображений

| Endpoint / bucket | Назначение |
|---|---|
| `POST /api/upload` | Публичный bucket `menu-images` (админка меню) |
| `POST /api/feedback/{token}/upload` | Private bucket `feedback-photos` (форма отзыва, service role) |
| `GET /api/feedback/{token}/photo/[...path]` | Signed URL для админки (auth session) |

### Миграции

SQL в `supabase/migrations/`. Применять через Supabase MCP / CLI / dashboard. Не дублировать список файлов в этом документе.

## API endpoints

| Endpoint | Описание |
|---|---|
| `POST /api/upload` | bucket `menu-images` |
| `POST /api/auth/send-otp` | OTP 4 цифры; `sendSms`; `brandSlug` по Host (`getBrandByHost`, только если host совпадает с `domain`/`devDomain`) |
| `GET /api/feedback/[token]` | Статус формы: `open` \| `expired` \| `already_submitted` + `brand_slug` |
| `POST /api/feedback/[token]` | Сохранение оценок + опционально `photo_urls[]` (≤3); негатив → Telegram + `tg_notified` |
| `POST /api/feedback/[token]/upload` | Multipart `file`; JPEG/PNG/WebP ≤5 MB; max 3 фото на заказ |
| `GET /api/feedback/[token]/photo/[...path]` | Фото для админки (signed redirect) |
| `GET /api/cron/feedback-sms` | Рассылка SMS с короткой ссылкой `/f/{short_code}`; Bearer `CRON_SECRET` |
| `PATCH /api/admin/feedback/[id]/resolve` | Резолюция негативного отзыва (admin auth) |
| `POST /api/auth/verify-otp` | Проверка + cookie `storefront-session`; для `losos` — `awardWelcomeBonus`, в ответе `{ welcomeBonus }` |
| `POST /api/auth/logout` | Очистка storefront session |
| `GET /api/auth/me` | Профиль по session; `{ profile: null }` без сессии |
| `GET /api/account/orders` | Последние 10 заказов профиля (401 без сессии) |
| `PATCH /api/account/profile` | `{ name }` → `profiles.name` |
| `GET /api/bonus/settings` | Публично: `accrualRate`, `maxRedemptionRate`, `isEnabled` |
| `GET /api/bonus/balance?profileId=` | `getUserBalance`; без `profileId` → `{ balance: 0 }` |
| `POST /api/[brandSlug]/checkout/pricing` | Server-side расчёт (`calculateOrderPricing`); `{ items, delivery_fee, delivery_mode, promo_code?, bonuses_to_redeem? }` → `PricingResult`; auth опционален для бонусов |
| `POST /api/[brandSlug]/checkout/pay` | Старт MAIB для `online_card` (требует `CARD_PAYMENT_ENABLED=true`); `{ orderId }` → `{ payUrl }`; пишет `maib_pay_id` |
| `POST /api/maib/callback` | Webhook MAIB (без auth): проверка подписи `validateMaibSignature`; `OK` → `paid_at` + Telegram; иначе отмена только если `status=new`; всегда **200** `{ ok: true }` |
| `GET /api/admin/bonus/settings` | Для админки (проценты ×100) |
| `POST /api/admin/bonus/adjust` | Корректировка `bonus_transactions`; `staff_id` из тела; `balance_after` через `getActualBalance` ± сумма; `amount` > 0, тип `manual_add` / `manual_deduct` |
| `POST /api/admin/inventory/ocr-invoice` | OCR накладной: `multipart` image → OpenAI (шаг 1 mini + шаг 2 nano) → `OcrInvoiceResult`; ошибки: `no_image`, `openai_error`, `ocr_parse_failed`, `match_parse_failed`, `internal` |
| `GET /api/avatar/[profileId]` | SVG DiceBear thumbs |
| `POST /api/pbx/incoming` | ОАТС (`crm_token` = `PBX_WEBHOOK_TOKEN`); cmd contact/event/history |
| `POST /api/pbx-webhook` | Legacy MoldCell → `incoming_calls` |
| `POST /api/telegram` | Курьерский бот webhook (`TELEGRAM_COURIER_WEBHOOK_SECRET`) |

## Server Actions

Каталог: `src/lib/actions/`. Для брендового контента в админке — фильтр через `getAdminBrandId()`; для склада/персонала — без фильтра.

### Витрина и общие

- `check-delivery-zone.ts` — `getActiveDeliveryZones` (фильтр `isZoneAvailableNow`, `attachResolvedZoneParams`), `geocodeAddress(query, zones?)`, `reverseGeocode` (Nominatim; с зонами — viewbox + `bounded=1` + `findZoneForPoint`).
- `create-order.ts` — заказ с витрины. **Перед insert** — `calculateOrderPricing` (те же параметры, что pricing API); в БД пишутся `subtotal`, `item_discount`, `promo_discount`, `discount`, `discount_rules_applied`, `total`, `bonuses_redeemed`, `promo_code` с сервера; `payment_method` incl. **`online_card`**. `order_items`: `price`, **`original_price`**, **`item_discount_pct`** из pricing; snapshot `variant_id`, `size`, `toppings`. После вставки — `redeemBonus` при `bonuses_redeemed > 0`. Telegram — **`sendNewOrderTelegramNotification(orderId)`** (экспорт; fetch заказа + items из БД), **кроме** `online_card`. Успех: `{ orderNumber, orderId }`. Адрес — одной строкой в `delivery_address`.
- `validate-promo-code.ts` — `validatePromoCode(code, subtotalBani, brandIdForOrder?)`. Витринная валидация.
- `discounts.ts` — `getActiveDiscountRules`, `resolvePromoCode`, `getStorefrontCartPricingBootstrap`, **`getStorefrontItemPercentCampaignRules`** (только `item_percent` для карточек меню).
- `account/update-profile.ts` — обновление через FormData (страница `/account` использует REST `PATCH`).
- `create-order-admin.ts` — заказ из админки.

### Админка

- `get-orders.ts` — без принудительного фильтра по `getAdminBrandId()`. Брэнд по URL.
- `update-order-status.ts`.
- `get-brands.ts`, `set-admin-brand.ts`.
- `admin/analytics.ts` — `getAnalyticsData` (KPI, день/день, топ позиций; фильтр `brandId`, `days` 7|14|30). Пагинация `.range(PAGE=1000)` для `orders`/`profiles`; батч `.in(order_id)` для популярных позиций.
- `admin/bonus-settings-action.ts` — `updateBonusSettings`.
- `admin/cash-sessions.ts` — `listCashSessions`, `getCashSessionDetail`, `listStaffForFilter`, `voidCashTransaction`, `editCashTransaction`.
- `admin/finance.ts` — `getExpenseCategories`, `getFinanceSettings`, `getExpenses`, `createExpense`, `deleteExpense`, `getGlovoSettlements`, `createGlovoSettlement`, `deleteGlovoSettlement`, `computePnL`.
- `admin/customers-list.ts` — `getCustomersList`.
- `admin/feedback.ts` — `fetchFeedbackPageData(brand?, from?, to?)`.
- `inventory/ingredient-categories.ts` — CRUD категорий (service role).
- `(admin)/admin/discount-rules/actions.ts` — `saveRule`, `deleteRule`, `toggleRuleActive`, поиск подарков/промокодов, **`fetchTargetMenuItemsForDiscountRule`**, **`fetchCategoriesForDiscountRule`** (service role).
- `(admin)/admin/menu/actions.ts` — CRUD позиций (`aggregator_price_bani`); `getMenuItemToppingGroups`, `setMenuItemToppingGroups` (`MenuItemToppingGroupAttachment`).
- `(admin)/admin/toppings/actions.ts` — `save_topping_with_recipes` (RPC, `p_aggregator_price_bani`).
- Inventory: `supplies/actions.ts` (`createSupplyOrder` → RPC `apply_supply_order_stock_items`; **`updateSupplyOrder`** → `replace_supply_order_stock_items`; `annulSupplyOrder` → RPC `annul_supply_order_stock`), `writeoffs/actions.ts` (`createWriteoff`, service role), `audits/actions.ts` (`createAudit`), `audits/[id]/actions.ts` (`updateAuditItem`, `confirmAudit`, service role). Полуфабрикаты: `(admin)/admin/inventory/semi-finished/actions.ts` (`createSemiFinished`, `updateSemiFinished`).
- `staff/staff-actions.ts`.

### POS (`src/lib/actions/pos/`)

- `auth.ts` — `verifyPin`, `logout` (только cookie), `getCurrentStaff`, `hasOpenShift`, `verifyCurrentStaffPin`.
- `shifts.ts` — `ensureActiveShift`, `closeShift` (закрытие `shift_logs`; не вызывается из `logout`).
- `cash-session.ts` — `openCashSession`, `getCashSession` (`payment_breakdown`, `manual_breakdown`, `recent_manual_transactions`), `getExpectedInDrawerBani`, `getActiveOrdersCountForShift`, `createCashTransaction`, `closeCashSession`, **`payOrder`** (см. инварианты в разделе POS / Касса).
- `create-draft-order.ts` — `createDraftOrderPos`.
- `update-order-brand-pos`, `update-order-details-pos`, `update-order-items`, `updateOrderDeliveryModePos`.
- `send-pos-draft-to-kitchen.ts` — `draft`/`new`/`confirmed` → `cooking`, `cooking_started_at`; при активной акции (`discount_rules` auto + schedule, `effect_type ≠ bonus_multiplier`) — обнуление `bonuses_redeemed`, `redeemBonus` пропускается; иначе `redeemBonus` **до** UPDATE (guard по свежему статусу); пересчёт `total`/`bonuses_redeemed` только под списание бонусов (не из каталога).
- `accept-order-pos`, `reject-order-pos` — для `new` + `source='website'`.
- `cancel-order-pos`, `delete-draft-order-pos`.
- `assign-courier-pos.ts` — `assignCourierPos`, `changeCourierPos`. После — `sendCourierAssignmentTelegram`.
- `courier-telegram-message.ts` — `sendCourierAssignmentTelegram`, `editPreviousCourierAssignmentTelegram`, `refreshCourierOrderTelegramMessage`.
- `fetch-orders.ts` — `ORDERS_POS_SELECT` (incl. **`subtotal`, `item_discount`, `promo_discount`**), `fetchPosOrders`, `fetchCompletedPosOrders`, `mergeOrdersPreserveBrandSlug`.
- `fetch-kds-orders.ts` — `fetchKdsCookingOrdersPos`, `fetchKdsOrderByIdPos`.
- `update-order-status-kds.ts` — `cooking → ready`.
- `customers-pos-actions.ts` — `posLookupCustomer` (профиль, **`addresses[]`**, `bonus_settings`), `posSaveCustomer`, `posSaveCustomerAddress`.
- `check-delivery-zone-pos.ts` — `checkDeliveryZoneByAddress` (возвращает `resolvedParams` при `in_zone`), `getZonesByBrandSlug` (+ `isZoneAvailableNow`, `attachResolvedZoneParams`).
- `create-order-pos.ts` — legacy one-shot создание; `items: PosCartItem[]`, `deliveryMode` incl. `aggregator`; `order_items` через `posLinePayloadFromCartItem(cartItem, isAggregator)`.
- `update-order-items.ts` — `addOrderItemsPos` / `replaceOrderItemsPos` / `updateOrderItemCompositionPos` принимают `PosCartItem[]` (или `cartItem`); `isAggregator = (delivery_mode === 'aggregator')`; insert/update через `posLinePayloadFromCartItem`. toppings JSON `{ id, name, price, quantity }`.

### Полезные lib (не actions)

- `lib/bonus.ts` — лояльность (витрина / POS); **`awardWelcomeBonus`** (welcome LOSOS); **`redeemBonus`** — идемпотентность по `bonus_transactions` (`type='redemption'`, `order_id`).
- `lib/admin/get-actual-balance.ts` — `getActualBalance` для админки клиентов.
- `lib/admin/orders-today-metrics.ts` — `getAdminOrdersTodayMetrics` (метрики заказов за UTC-сутки; `.range`, PAGE=1000).
- `lib/admin/inventory/invoice-ocr-types.ts` — типы OCR накладной (`OcrInvoiceResult`, `OcrMatchedItem`, `vat_rate`).
- `lib/customers.ts` — `getCustomerByPhone` (JOIN `customer_addresses`), `saveCustomer`, `saveCustomerAddress`, `setDefaultAddress`, `getDefaultAddress`. Service role.
- `lib/delivery-zone-schedule.ts` — `getActiveSchedule`, `isZoneAvailableNow`, `resolveZoneParams`, `attachResolvedZoneParams`.
- `lib/actions/admin/delivery-zone-schedules.ts` — CRUD слотов расписания зоны.
- `lib/discount.ts` — `calcCompareAt`, `calcPromoDiscount`, **`discountRateFromEffectValue`** (нормализация `effect_value` для `item_percent`).
- `lib/pricing.ts` — **`calculateOrderPricing`** (server-side расчёт витрины; шаг 2b `item_percent`, `active_promotion`, `.eq('brand_id')`; см. раздел «Скидки»).
- `lib/storefront-item-campaign-discount.ts` — **`getItemCampaignDiscount`** (отображение зачёркнутой цены в меню; не корзина).
- `lib/resolve-brand-id.ts` — `resolveBrandIdBySlug` для API по slug бренда.
- **`lib/maib/token.ts`** — кэш OAuth MAIB в `maib_tokens` (singleton `id=1`), `getMaibAccessToken()` (refresh / project credentials).
- **`lib/maib/signature.ts`** — `validateMaibSignature` для webhook (ksort + SHA256 binary → Base64).
- **`lib/maib/client.ts`** — `createMaibPayment`, `getMaibPaymentInfo`, `refundMaibPayment` (`MAIB_BASE_URL`, Bearer).
- `lib/receipt-pricing-breakdown.ts` — `buildReceiptPricingBreakdown` для термочека.
- `lib/discount-engine.ts` — `evaluateDiscounts`, `isRuleScheduleActive` (pure, без Supabase; POS + UI корзины; `item_percent` + исключение `exclude_from_discounts` при явном `target_item_ids`).
- `lib/order-recipe-stock-deduction.ts` — `computeIngredientTotalsForOrder`.
- `lib/inventory-units.ts`.
- `lib/ingredient-avg-cost.ts` — `parseIngredientAvgCostStorage` из embed `ingredient_stock`.
- `lib/semi-finished-cost.ts` — `computeSemiInputCostMdl`, `semiCostPerStorageUnitMdl`, `buildSemiFinishedCatalogMap` (рекурсивная себестоимость п/ф по составу).
- `lib/pos/split-composite-delivery-address.ts` — `splitCompositeDeliveryAddress`, `posCheckoutAddressFieldsFromOrder` (раскладка подъезд/этаж/кв. из строки `delivery_address`; POS «Детали» и адрес в Telegram курьеру).
- `lib/product-recipe-cost.ts` — `buildProductRecipeCostContext`, `enrichProductRecipeCostContext`, `productRecipeLineCostMdl`, `computeMaterialRecipeCostMdl`, `computeReferencedMenuItemRecipeCostMdl`, `buildMenuItemRecipeCostMap`, `resolveMenuRefRecipeVariantFilter` (себестоимость техкарт: ингредиент + п/ф + комбо).
- `lib/recipe-editor-qty.ts`, `lib/recipe-composition-row-updates.ts`, `lib/recipe-composition-waste.ts`, `lib/product-recipe-ingredient-qty.ts`, `lib/recipe-composition-types.ts` (`RecipeCompositionSemi.cost_per_storage_unit`).
- `lib/topping-pricing.ts` — `calcToppingGroupCharge`, `calcToppingChargesById`, `getFreeUnitsRemaining`, `formatStorefrontToppingGroupHeader`.
- `lib/topping-recipe-match.ts` — сопоставление `order_items.toppings` ↔ `topping_recipes` (id, fallback name_ru/name_ro).
- `lib/format-mdl.ts` — `formatMdl` для UI сумм в MDL по значениям в bani.
- `lib/topping-max-selection.ts`, `lib/cart-toppings.ts`, `lib/cart-helpers.ts` (`getCartItemToppingDisplayGroups`, `getCartItemSizeLabel`).
- `lib/pos-cart-toppings.ts` — `posAddTopping`, `posRemoveTopping`, `migratePosCartToppingsFromLegacy`, `posCartToppingsConfigKey`.
- `lib/pos-cart-helpers.ts` — `calcPosToppingsCharge(..., isAggregator)`, `getPosCartItemUnitPriceBani(item, isAggregator)`, `posLinePayloadFromCartItem(item, isAggregator)`, `posToppingsPayloadForDb` → JSON `{ id, name, price, quantity }`, `getPosCartItemToppingDisplayLines`.
- `lib/pos/menu-item-modal-row.ts` — `POS_MENU_ITEM_FOR_MODAL_SELECT` (вкл. `aggregator_price_bani`), `posMenuRowForModal`, `posVariantsFromMenuEmbed`.
- `components/topping-stepper-card.tsx` — общая карточка топпинга (витрина + POS).
- `components/pos/order-form/pos-address-cards.tsx` — карточки сохранённых адресов на шаге «Детали» POS.
- `components/admin/customers/` — `customers-page-client.tsx`, `customers-filters.tsx`, `customers-table.tsx`.
- `components/admin/cash-sessions/cash-transaction-actions.tsx` — void/edit кассовых транзакций в детали смены.
- `components/admin/finances/period-filter.tsx` — общий compact Popover-фильтр периода (`?from=` / `?to=`, пресеты 7 дней / месяц): `/admin/finances`, `/admin/finances/expenses`, `/admin/finances/glovo`, **`/admin/inventory/supplies`**.
- `components/client/cart/storefront-cart-pricing.ts` — `evaluateStorefrontCartDiscount`, `allocateGiftFreeUnitsByCartLineId`.
- `components/client/storefront-campaign-rules-context.tsx` — `StorefrontCampaignRulesProvider`, `useStorefrontCampaignRules` (правила `item_percent` для карточек меню).
- `components/client/welcome-bonus-modal.tsx` — модалка welcome-бонуса LOSOS после OTP.
- `lib/data/storefront-item-toppings.ts` — `fetchStorefrontMenuItemToppingGroups` (`free_count` с `menu_item_topping_groups`; select включает `aggregator_price_bani` у топпингов).
- `lib/order-item-size-display.ts`.
- `lib/storefront-delivery-display.ts`, `lib/storefront-pickup-location.ts`, `lib/storefront-account-path.ts`.
- `lib/brand-phone.ts` — `getBrandPhone(slug)`.
- `lib/seo/brand-seo.ts`, `lib/seo/menu-item-image-alt.ts`.
- `lib/pbx/diversion-brand-slug.ts`.
- `lib/pos/alert-sound.ts`, `kds-wakeup.ts`, `scheduled-slots.ts`, `split-composite-delivery-address.ts`, `pos-brand-slug-cookie.ts`, `menu-item-modal-row.ts`, `use-incoming-call.ts`.
- `lib/rawbt.ts` — RawBT intent: текст, открытие денежного ящика.
- `lib/receipt-print.ts` — snapshot offscreen-чека и inline-печать PNG через RawBT.
- `components/ReceiptTemplate.tsx` — React-шаблон термочека для `printReceipt` (prop `pricing` — breakdown скидок).
- `hooks/use-checkout-pricing.ts`, `hooks/use-store-open.ts`, `hooks/use-persist-store-hydration.ts`, `lib/store-hours.ts` — checkout pricing + часы витрины (Chisinau).
- `lib/store/cart-store`, `store-closed-store`, `auth-store` (**`welcomeBonusPending`**), `pos-order-from-call-bridge`, `pos-menu-cache`, `language-store`, `delivery-store` (fee через `resolvedParams.delivery_price_bani`).
- `lib/supabase/server.ts`, `client.ts`, `service-role.ts`.
- `lib/sms.ts` — `sendSms` (SMS.md GET API); `lib/feedback.ts` (`getFeedbackSmsText`, short URL), `lib/feedback-telegram.ts` (текст + фото).
- `lib/leaflet-fix-default-icon.ts`.

## Дизайн

Источник правил: `DESIGN.md`.

Палитра Food Service. Глобальные токены и переопределения `[data-brand="..."]` — в `src/app/globals.css` (импортируется только из `src/app/layout.tsx`). Селектор `[data-brand="the-spot"], [data-brand="losos"], [data-brand="kitch-pizza"]` — `background: var(--color-bg)`, `color: var(--color-text)`.

Ключевые CSS-переменные:
- `--color-bg`, `--color-text`, `--color-accent`
- `--color-accent-text` — текст на сплошном акценте
- `--color-accent-foreground` — текст на мягком акценте (shadcn `--accent-foreground`)
- `--color-input-bg` + класс `.storefront-input`
- `--color-selector-item-bg`
- `--size-selector-*`

Шрифты: Inter 400/700 и Roboto Mono 400/700.

Storefront: использовать brand-aware primitives (`storefront-modal-*`, `storefront-checkout-*`, `storefront-input`); не дублировать цвета локально.

## Environment

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# POS PIN-сессия (≥32 символов)
POS_SESSION_SECRET=

# SMS.md (OTP, feedback cron, кампании)
SMS_MD_API_KEY=
SMS_MD_SENDER=              # fallback, если brandSlug не передан в sendSms

# Онлайн-оплата на витрине (по умолчанию выключено)
NEXT_PUBLIC_CARD_PAYMENT_ENABLED=false
CARD_PAYMENT_ENABLED=false

# Cron feedback-sms (Bearer в GitHub Actions и при ручном вызове)
CRON_SECRET=              # также GitHub repo secret CRON_SECRET для workflow

# Негативные отзывы → Telegram
TELEGRAM_FEEDBACK_BOT_TOKEN=
TELEGRAM_FEEDBACK_CHAT_ID=

# Уведомления о заказах с витрины (отдельный канал)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Курьерский бот (отдельный, не путать)
TELEGRAM_COURIER_BOT_TOKEN=
TELEGRAM_COURIER_BOT_USERNAME=    # без @
TELEGRAM_COURIER_WEBHOOK_SECRET=

# Базовый URL для setup:telegram
NEXT_PUBLIC_APP_URL=

# Webhook ОАТС (crm_token в теле запроса)
PBX_WEBHOOK_TOKEN=

# OCR накладных в админке (/api/admin/inventory/ocr-invoice)
OPENAI_API_KEY=

# MAIB Merchants (онлайн-оплата витрины)
MAIB_BASE_URL=              # default https://api.maibmerchants.md
MAIB_PROJECT_ID=
MAIB_PROJECT_SECRET=
MAIB_SIGNATURE_KEY=         # проверка webhook callback
MAIB_CALLBACK_URL=          # публичный URL → POST /api/maib/callback (стабильный prod URL)
```

Таблицы MAIB / маркетинг (вне сгенерированных types — `as any` в коде до `supabase gen types`):

| Таблица | Назначение |
|---|---|
| `maib_tokens` | Кэш access/refresh токенов API MAIB (`id=1`) |
| `campaigns` | SMS-кампания: `sms_text`, `segment_config` (в т.ч. `bonus_amount`, `min_orders`, `order_period_days`, `inactive_days`), `status`, `sent_at`, `total_recipients` (без `updated_at`) |
| `campaign_sends` | Лог отправки: `campaign_id`, `profile_id`, `phone`, `status`, `error_msg`, `sent_at` |
| `order_feedback` | Отзывы после заказа: `token`, `short_code`, рейтинги, резолюция, `tg_*` (см. раздел feedback) |

## npm scripts

| Script | Команда |
|---|---|
| `dev` | `next dev --turbo` |
| `dev:webpack` | `next dev` |
| `dev:clean` | `rm -rf .next && next dev --turbo` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `setup:telegram` | `npx tsx scripts/setup-telegram-webhook.ts` |

**One-off скрипты (не в package.json):**

```bash
# SMS-кампания + бонусы (константа CAMPAIGN_ID в scripts/send-campaign.ts)
npx tsx -r dotenv/config scripts/send-campaign.ts dotenv_config_path=.env.local
```

`send-campaign.ts`: сегмент из `profiles` (Poster: `poster_orders_count`, `poster_last_order_at`, неактивность vs `orders.status=done`); `bonus_amount` из `campaign.segment_config`; пакеты по 10, пауза 1 с; SMS inline через SMS.md GET API (`SMS_MD_SENDER`); `manual_add` в `bonus_transactions`; идемпотентность — пропуск если уже есть строка в `campaign_sends`; финальный UPDATE: `status`, `sent_at`, `total_recipients`.

## Deploy

Корневой `vercel.json`: только **301-редиректы** `/ru`, `/ru/*`, `/ro`, `/ro/*` → корень сайта (`permanent: true`).

**Cron feedback-sms:** GitHub Actions `feedback-sms-cron.yml` (каждые 10 мин) → `curl` на `https://losos.md/api/cron/feedback-sms` с `Authorization: Bearer $CRON_SECRET`. Секрет `CRON_SECRET` — в Vercel env **и** в GitHub Actions secrets. На Vercel Hobby нельзя ставить cron `*/10` в `vercel.json`.

Язык витрины — в localStorage (`lang`), не в URL.

## Dev notes

- `tsconfig.json`: `"baseUrl": "."` для алиаса `@/*`.
- Turbopack после HMR падает с ошибками типа `Tooltip must be used within TooltipProvider`, `module factory is not available` (часто после правок `CourierMapModal` / динамических импортов) — `npm run dev:clean`.
- 404 на chunks/CSS или `Cannot find module './NNN.js'` — `npm run dev:clean`.
- Не запускать два `next dev` параллельно (второй уйдёт на :3001).
- `/etc/hosts` для локальных доменов: `127.0.0.1 losos.md www.losos.md thespot.md www.thespot.md`.
- Тест с телефона в одной Wi-Fi: `npm run dev -- -H 192.168.50.137`, открыть `http://192.168.50.137:3000/`.
- **POS + RawBT:** печать и ящик работают только на Android-терминале с установленным RawBT; предчек — кнопка «Печать предчека» в мастере (шаг 2) или временные test-кнопки на `/pos`.
- При проблемах с Turbopack: `npm run dev:webpack`.

## TODO

- Свести один путь `delivery → done`: либо только `payOrder` из `OrderDetail`, либо убрать быстрый «Выдан» с `OrderCard`.
- Выровнять localStorage keys корзины/доставки с `BrandConfig.cartKey` / `deliveryKey`.
- Guard checkout по сессии (если потребуется).
- Подключить `night_delivery_price_bani` / `active_from` / `active_to` зоны в `resolveZoneParams` (сейчас только слоты + базовые колонки; колонки в БД — миграция `*_delivery_zones_night_and_window.sql`, применить на remote Supabase).
- Доработать gallery и lunch sets в админке.
- Перегенерировать `src/lib/supabase/types.ts` через `supabase gen types` (в т.ч. `semi_finished_items.semi_finished_ref_id`, RPC `apply_supply_order_stock_items`, `revert_supply_order_stock_items`, `replace_supply_order_stock_items`, `annul_supply_order_stock`).
- Применить на remote Supabase миграции: **`get_customers_list`** (`*_get_customers_list.sql`, колонки Poster на `profiles`); **`orders_discount_breakdown`** (`*_orders_discount_breakdown.sql` — `subtotal`, `item_discount`, `promo_discount`, `order_items.original_price`, `item_discount_pct`); **`orders.maib_pay_id`** (если ещё нет в remote); таблицы **`maib_tokens`**, **`campaigns`**, **`campaign_sends`** для MAIB и `send-campaign.ts`; таблица **`order_feedback`** (+ `short_code` unique, `photo_urls`, FK на `orders`/`brands`); bucket **`feedback-photos`**; **`cash_transactions.edited_at`**, **`edited_by_user_id`** (если edit в админке падает); склад поставок — `*_apply_supply_stock_rpc.sql`, `*_revert_supply_stock_and_update.sql`, **`annul_supply_order_stock`**.
- Перевести `scripts/send-campaign.ts` на `lib/sms.ts` с `brandSlug` (сейчас inline SMS.md GET).
- Интегрировать **`calculateOrderPricing`** в POS (`update-order-details-pos`, предчек) и учёт топпингов в server-side pricing.
- Подключить списание ингредиентов в `payOrder` через `computeIngredientTotalsForOrder`.
- **`computePnL`** (`admin/finance.ts`): выборка `orders` за период без пагинации — при >1000 заказов P&L занижается (тот же PostgREST-лимит; нужна пагинация или RPC-агрегация).
- Убрать временные RawBT test-кнопки с `/pos` после стабилизации печати на терминале.
- Подпись «Позвонить …» в `storefront.ts` под бренд (или оставить динамику в `aria-label` через `getBrandCallLabel`).
