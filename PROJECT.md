# Food Service / Kitch POS

Multi-brand витрина доставки еды, админка и POS в одном Next.js приложении.

## Бренды

- `kitch-pizza` (домен `kitch.md`)
- `losos` (домен `losos.md`, путь `/losos` на localhost)
- `the-spot` (домен `thespot.md`, путь `/thespot` на localhost; в URL — `thespot` без дефиса, канон в конфиге — `the-spot`)

Канонический конфиг: `src/brands/index.ts`. Нормализация slug — `normalizePosBrandSlug` + `getBrandBySlug`.

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
│   ├── (client)/        # витрина, checkout, account
│   ├── (admin)/admin/   # админка
│   ├── pos/             # POS + KDS (страницы App Router)
│   ├── api/             # REST endpoints
│   ├── robots.ts, sitemap.ts
│   ├── globals.css
│   └── layout.tsx       # root, <html lang="ro">
├── brands/              # BrandConfig + host→brand
├── components/
│   ├── client/          # витрина, корзина, checkout, auth
│   ├── admin/           # AdminShell, sidebar, finances/, analytics, inventory, customers/, cash-sessions/
│   ├── pos/             # PosAppShell, OrderForm, KdsScreen; order-form/pos-address-cards.tsx
│   ├── ReceiptTemplate.tsx  # offscreen-шаблон термочека 576px (RawBT)
│   ├── store-closed-modal.tsx  # оверлей «магазин закрыт» (витрина)
│   ├── topping-stepper-card.tsx  # карточка топпинга со stepper (витрина + POS)
│   ├── seo/JsonLd.tsx
│   ├── MetaPixel.tsx
│   └── ui/              # shadcn
├── hooks/
│   ├── use-store-open.ts       # часы работы витрины по BrandConfig (Europe/Chisinau)
│   └── use-persist-store-hydration.ts  # ожидание zustand persist (checkout и др.)
├── lib/
│   ├── actions/         # server actions (см. раздел Server Actions)
│   ├── data/            # storefront fetchers
│   ├── store/           # Zustand stores (cart, delivery, store-closed, …)
│   ├── i18n/, pos/, pbx/, seo/, telegram/, supabase/
│   ├── admin/           # get-actual-balance, orders-url, cash-sessions-url, orders-today-metrics
│   ├── actions/admin/customers-list.ts, analytics.ts, delivery-zone-schedules.ts
│   ├── bonus.ts, customers.ts, discount-engine.ts
│   ├── rawbt.ts, receipt-print.ts  # Android RawBT: текст, ящик, предчек PNG
│   ├── store-hours.ts, cart-toppings.ts, cart-helpers.ts, topping-pricing.ts, topping-max-selection.ts
│   ├── pos-cart-toppings.ts, pos-cart-helpers.ts
│   ├── delivery-zone-schedule.ts  # слоты расписания зоны (Europe/Chisinau)
│   ├── inventory-units.ts, recipe-*.ts
│   ├── product-recipe-cost.ts, semi-finished-cost.ts, ingredient-avg-cost.ts
│   ├── order-recipe-stock-deduction.ts
│   └── ...
├── types/               # database, cart, pos, promotions, customers
├── scripts/
└── middleware.ts
```

Корень репозитория: `vercel.json` (301 `/ru`, `/ro` → `/`), `supabase/migrations/`.

## Контракты

### Money & единицы

- **Заказы в БД — integer bani** (`orders.total`, `price`, `discount`, `delivery_fee`, `bonuses_redeemed`, все `*_bani`). В UI — MDL.
- **Агрегаторные цены (Glovo):** колонки `aggregator_price_bani` (nullable integer bani) на `menu_items`, `menu_item_variants`, `toppings`. В админке ввод в MDL (÷100); `NULL` = использовать обычную `price`. В POS при `delivery_mode='aggregator'` в корзину и `order_items` пишутся агрегаторные цены (если заданы), иначе fallback на каталожную цену.
- **Склад в БД — numeric MDL** (`ingredient_stock.avg_cost`, цены в `supply_order_items`). Не bani.
- **Склад: единица хранения в БД — g / ml / pcs**. В UI админки — кг / л / шт; цены — MDL за кг/л/шт. Конвертация: `src/lib/inventory-units.ts` (`toDisplayQty`/`toStorageQty`, `toDisplayPrice`/`toStoragePrice`).
- **Исключение:** редактор техкарт (`RecipeEditorModal`), `semi-finished-dialog`, состав топпинга (`RecipeIngredientSemiCompositionTable`) — работают напрямую в г/мл/шт, без конвертации.
- 1 бонус. пункт = 1 MDL = 100 bani.

### Order — каноничные значения

`OrderStatus` (src/types/database.ts): `draft` · `new` · `confirmed` · `cooking` · `ready` · `delivery` · `done` · `cancelled` · `rejected`.

`delivery_mode`: `delivery` · `pickup` · `aggregator`.

`payment_method`: `cash` · `card` · `aggregator_card` · `mixed`.

`source`: `website` · `pos`.

`aggregator`: пока только `glovo` (для `delivery_mode='aggregator'`).

### Поля orders (избранное)

| Поле | Назначение |
|---|---|
| `status`, `delivery_mode`, `payment_method`, `source` | см. выше |
| `total`, `discount`, `delivery_fee`, `cash_amount`, `card_amount`, `change_from` | суммы в bani |
| `delivery_address`, `address_entrance/floor/apartment/intercom`, `delivery_lat/lng` | доставка |
| `courier_id`, `courier_assigned_at`, `delivered_at` | курьер |
| `courier_tg_chat_id`, `courier_tg_message_id`, `courier_tg_message_updated_at` | Telegram-карточка курьера |
| `comment` | общий комментарий (витрина + POS) |
| `kitchen_note` | комментарий повару, **только из POS**; KDS показывает плашкой |
| `scheduled_time` (timestamptz) | предзаказ POS на доставку; сбрасывается при смене на `pickup` |
| `cooking_started_at`, `ready_at`, `paid_at` | KDS-таймеры и касса |
| `cash_session_id` | FK кассовой сессии при оплате |
| `aggregator`, `prep_deadline_at` | агрегатор (Glovo) и дедлайн готовки (+15 мин от создания) |
| `profile_id` | FK на `profiles` (витрина или клиент POS) |
| `bonuses_redeemed`, `bonuses_earned` | пункты лояльности |
| `bonus_multiplier` (numeric, default 1) | множитель начисления при `done` |
| `promo_code`, `discount_rules_applied` (JSON) | скидки |

`order_items`: `variant_id` (FK `menu_item_variants`, nullable), `size` (текстовый snapshot подписи варианта; старые строки могут иметь `s`/`l`), `toppings` (JSONB: `{ name, price, quantity }[]`, тип `OrderItemTopping`), `is_gift`, `gift_rule_id`. Поле `price` — **итог строки в bani** (`unit × quantity`); unit включает базу позиции + платные топпинги. Для Glovo unit и `toppings[].price` в JSON берутся из `aggregator_price_bani` каталога (см. `posLinePayloadFromCartItem`).

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

httpOnly cookie. OTP-вход по телефону: 4 цифры через SMS.md (`POST /api/auth/send-otp`, `verify-otp`). Клиентский `fetch` к `/api/auth/me`, `/api/account/*`, `/api/bonus/balance` — обязательно с `credentials: 'include'`. Сессия в коде: `getStorefrontSession()`.

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
- Левая `OrderCard` (`components/pos/order-card.tsx`) — **только просмотр**: статус и курьер read-only. Все переходы статусов делаются из мастера/деталки (`update-order-status-kds`, `assign-courier-pos`, `payOrder`). Карточки со статусом **`new`** или **`confirmed`** — оранжевая внутренняя обводка `ring-2 ring-inset ring-orange-400` (при выборе — чёрная `ring-[#242424]`).
- Принять / отклонить заказ с сайта (`new` + `source='website'`) — только из `OrderDetail` (`accept-order-pos`, `reject-order-pos`).

### Мастер заказа (OrderForm)

Шаги: **Бренд → Оформление (меню + корзина) → Детали**. Привязан к `orderId`; `key={panel.orderId}` меняется только при явной смене заказа.

**Создание черновика** — `createDraftOrderPos`:
- `delivery` / `pickup` — обычный заказ.
- `aggregator` — Glovo: ставит `aggregator='glovo'`, `payment_method='aggregator_card'`, `prep_deadline_at` = +15 мин.
- Из входящего звонка: `createDraftOrderPos({brandSlug, userPhone, profileId, userName})` — резолв `brand_id`, открытие мастера на шаге 2.

**Меню в мастере:** `usePosMenuCache` (на время браузерной POS-сессии: категории, items с вариантами и группами топпингов, индексы). Выборка `POS_MENU_ITEM_FOR_MODAL_SELECT` (`lib/pos/menu-item-modal-row.ts`) включает `aggregator_price_bani` для `menu_items`, `menu_item_variants` и nested `toppings`. Fallback — Supabase запрос с той же константой. Cookie `pos-brand-slug` обновляется при выборе бренда (синхронизация с KDS).

**Шаг «Оформление» (меню + корзина):**
- Кнопка **«Печать предчека»** в `CartPanel` (шаг 2): offscreen `<ReceiptTemplate ref={receiptRef} {...receiptProps} />` (`position:absolute; left:-9999px`) → `printReceipt(node, orderNumber)` из `lib/receipt-print.ts`. Данные чека: номер заказа, дата, позиции корзины (имя, размер, топпинги), итог после списания бонусов, расчёт начисляемых бонусов (`accrual_rate` 5% × `bonusMultiplier`), баланс клиента, канал (`delivery` / `pickup` / Glovo). Disabled при пустой корзине.

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
- **Списание бонусов:** поле при найденном клиенте, `total > 0`, `balance > 0`. Потолок = `floor(min(balance, totalBani/100 × max_redemption_rate))`. `totalBani` после скидок и доставки.
- Все правки на «Деталях» уходят через `updateOrderDetailsPos` с **debounce 600 мс** (контакт, адрес, координаты, comment, kitchen_note, profile_id, скидки, промо, синхронизация подарочных строк).

**Скидки в мастере:** `getActiveDiscountRules` (trigger=`auto`) загружается на сервере; промокод через `PromoPanel` + `resolvePromoCode` (`discounts.ts`); финальный расчёт через `evaluateDiscounts` (`src/lib/discount-engine.ts`) с `excludedCategoryIds` из `usePosMenuCache`. Для заказов с сайта с непустым `promo_code` — флаг `skipSeedResolve` (быстрый показ без асинхронного `resolvePromoCode`).

**Меню `⋯` мастера:** «Сделать доставкой» / «Сделать навыносом» (`updateOrderDeliveryModePos` — сбрасывает `aggregator`, `prep_deadline_at`, `scheduled_time` при переходе на pickup; нормализует `aggregator_card → cash`). При смене типа заказа **с** или **на** `aggregator`, если корзина не пуста — confirmation «При смене типа заказа корзина будет очищена»; после подтверждения — `replaceOrderItemsPos([])` и смена режима. «Очистить корзину», «Закрыть заказ» (`cancelOrderPos`).

**«Отправить бегунок»** — `sendPosDraftToKitchen`:
- Действует для `draft` / `new` / `confirmed` → `cooking`. Идемпотентно: уже в `cooking` — успех с тем же id.
- Проставляет `cooking_started_at`, `updated_at`. Пересчитывает `total` только под **списание бонусов**: берёт уже сохранённый `orders.total` (нетто), восстанавливает gross (`+ bonuses_redeemed × 100`), вычитает новое списание → `bonuses_redeemed`. **Не** пересчитывает subtotal из каталога/`aggregator_price_bani` — агрегаторные цены должны быть записаны в `order_items` на шаге «Оформление» (`replaceOrderItemsPos` / `addOrderItemsPos`).
- Затем `redeemBonus` из `lib/bonus.ts` (если `bonuses_redeemed > 0` и есть `profile_id`). Ошибки только в `console.error`, заказ не откатывается.
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
| `src/lib/receipt-print.ts` | `printReceipt(node, orderNumber)` — `html-to-image` `toPng` (576px, `pixelRatio:1`, `#fff`) → payload `rawbt:data:image/png;base64,...` → `encodeURIComponent` + intent RawBT |
| `src/components/ReceiptTemplate.tsx` | Шаблон предчека: 576px (лента 80 мм), только `#000`/`#fff`, логотип LOSOS, инверсная шапка/ИТОГО, позиции, бонусы, QR, футер с телефоном; RU/RO подписи |

**Поток предчека:** рендер offscreen DOM → snapshot PNG → inline intent (без Supabase Storage и без `PrintDownloadActivity`). Перед snapshot — `document.fonts.ready`. Временный diagnostic `alert` с длиной data URL и номером заказа (лимит длины Android intent).

**Тестовые кнопки** на главной POS (`page.tsx`) — см. раздел «POS (главная страница)».

## Telegram

### Два разных бота

| Бот | Назначение | Env |
|---|---|---|
| Заказы с витрины | Уведомления в общий чат при `createOrder` (`src/lib/actions/create-order.ts`) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Курьерский | Привязка курьеров, смены, live location, карточки заказов | `TELEGRAM_COURIER_BOT_TOKEN`, `TELEGRAM_COURIER_BOT_USERNAME`, `TELEGRAM_COURIER_WEBHOOK_SECRET` |

### Курьерский бот

- Webhook: `POST /api/telegram` с заголовком `X-Telegram-Bot-Api-Secret-Token`. Команды: `/start` (привязка по токену), `/shift_start`, `/shift_end`; live location → `courier_locations`.
- Исходящие — через `src/lib/telegram/bot.ts`: `sendMessage(chatId, text, replyMarkup?)` → `message_id`, `sendLocation(chatId, lat, lng, replyToMessageId?)`, `editMessageText(chatId, messageId, text, replyMarkup?)`.
- При assign (`sendCourierAssignmentTelegram` в `courier-telegram-message.ts`):
  1. `sendMessage` — карточка заказа (`buildCourierAssignmentMessage`): заголовок «🛵 Новый заказ #N», опционально 👤 имя, 📞 телефон, 📍 адрес (через `posCheckoutAddressFieldsFromOrder` / `split-composite-delivery-address`), **🕐 Доставить до:** расчётное время = `created_at` + 1 ч (`Europe/Chisinau`, `estimatedDeliveryTime`), блок «Состав заказа» (`• qty x name — price MDL` из `order_items.price` в bani), итоги: 🧾 сумма заказа = `total - delivery_fee`, 🚗 доставка («Бесплатно» или MDL), 💰 к оплате + способ (`Наличными` / `Картой` / `Смешанная оплата`). Select (`COURIER_ORDER_ASSIGNMENT_SELECT`, `COURIER_ORDER_TELEGRAM_SELECT`) включает `created_at`, `delivery_fee`.
  2. `sendLocation` с `reply_to_message_id` к карточке, если есть координаты (иначе `withResolvedDeliveryCoords` + `checkDeliveryZoneByAddress`).
  3. В `orders` пишутся `courier_tg_chat_id`, `courier_tg_message_id` (**только текстовая карточка**, для `editMessageText`), `courier_tg_message_updated_at`.
- При смене курьера: старая карточка правится через `editPreviousCourierAssignmentTelegram`, новому курьеру — новая пара.
- Обновления (`refreshCourierOrderTelegramMessage`) после `update-order-items` и `update-order-details-pos` в `delivery`: `editMessageText` карточки; при `reason='details'` дополнительно `sendLocation`. Короткое update-notice через `sendMessage` — **не чаще 1/мин** (throttle по `courier_tg_message_updated_at`).
- Регистрация webhook: `npm run setup:telegram` (`scripts/setup-telegram-webhook.ts`, требует `NEXT_PUBLIC_APP_URL`).

## Скидки и лояльность

### Движок скидок

`src/lib/discount-engine.ts`: чистая функция `evaluateDiscounts(input)` + `isRuleScheduleActive`. Без Supabase.

Типы эффектов (`src/types/promotions.ts`): `item_percent`, `order_percent`, `order_fixed`, `cheapest_item_free`, `free_delivery`, `bonus_multiplier`, подарки.

**`cheapest_item_free`:** правило `free_every_n` + опциональный потолок **`max_free_items`** (ограничивает число бесплатных единиц за применение правила). Результат — `giftItems: GiftCartItem[]` (`menu_item_id`, `variant_id`, `quantity`, `rule_id`, `label_ru`).

`DiscountEngineInput.excludedCategoryIds` — категории `menu_categories.exclude_from_discounts`. Не участвуют в `item_percent`, `order_percent`, `order_fixed`, `cheapest_item_free`. На `free_delivery`, `bonus_multiplier`, подарки — не влияют.

Источники: таблица `discount_rules` (`trigger='auto'` или `promo`) + `promo_codes` (legacy, через синтетическое правило в `resolvePromoCode`).

В `orders` сохраняется: `discount`, `discount_rules_applied` (JSON применённых правил), `promo_code`, `delivery_fee`, `bonus_multiplier`. Подарочные строки — `order_items.is_gift` + `gift_rule_id`.

Bootstrap для витрины — `getStorefrontCartPricingBootstrap` в `discounts.ts`: авто-правила, `excludedDiscountCategoryIds`, `storefrontExcludedDiscountCategories` (с именами категорий для подсказок).

Сборка корзины витрины — `src/components/client/cart/storefront-cart-pricing.ts` (`CartItemForEngine` + `evaluateStorefrontCartDiscount` → `evaluateDiscounts`; **`allocateGiftFreeUnitsByCartLineId`** — раздаёт `giftItems.quantity` по строкам корзины в порядке `items`). Подсказки: `storefront-discount-excluded-notice.tsx`, `storefront-promo-excluded-warning.tsx`.

**Отображение бесплатных позиций в корзине витрины:** `CartContent` передаёт в `CartItemCard` `giftFreeUnits` (из allocation). На карточке — зачёркнутая сумма бесплатной части + зелёное «0 лей»; при частично платной строке — дополнительно сумма за платные единицы. Итоги корзины (`totalDiscountBani`) не меняются — только UI цены строки.

В POS-мастере: `mergePersistedWebsitePromoDiscount` подмешивает сохранённое `listOrder.promo_code` / `discount` пока движок ещё не дал полный выход.

### Лояльность

Таблицы: `bonus_settings` (id=1; `accrual_rate`, `max_redemption_rate`, `is_enabled`, `updated_at`), `bonus_transactions` (`profile_id`, `amount`, `balance_after`, `type`, `created_by`).

Lib: `src/lib/bonus.ts`. Все функции — service role (`createServiceSupabaseClient`).

- `getUserBalance(profileId)` — последняя `balance_after` в `bonus_transactions` (**витрина, POS, `/api/bonus/balance`**).
- **`getActualBalance(profileId)`** — `src/lib/admin/get-actual-balance.ts`: тот же алгоритм (последний `balance_after`); **админка** — заголовок `/admin/customers/[id]` и `POST /api/admin/bonus/adjust` (расчёт `balance_after` новой транзакции = текущий ± сумма).
- `getBonusSettings()`, `manualAdjust`, `accrueBonus`, `redeemBonus`, `processBonusAccrualOnOrderDone(profileId, orderId, totalBani, multiplier?)`.

**Список клиентов (RPC `get_customers_list`):**

- Миграция `*_get_customers_list.sql`: агрегаты заказов с сайта (`status='done'`), Poster (`profiles.poster_orders_count`, `poster_last_order_at`), `bonus_balance` = последний `balance_after`, `total_count` на строке.
- Server action `lib/actions/admin/customers-list.ts` → `getCustomersList(filters, page)` (service role, `CUSTOMERS_PAGE_SIZE = 50`).
- Страница `/admin/customers`: RSC `page.tsx` читает `?search=`, `?page=`; клиент **`CustomersPageClient`** (`components/admin/customers/`): поиск (debounce), **Popover-фильтры** (`customers-filters.tsx`: сортировка, мин. заказов, только с бонусами, даты регистрации, активность 30/60/90/180 дней), таблица (`customers-table.tsx`), пагинация `« ‹ › »`.
- Колонки таблицы: клиент (телефон + имя), регистрация, заказов (tooltip: сайт + Poster), потрачено (только site LTV), последний заказ, бонусы. Клик → `/admin/customers/[id]`.
- Legacy RPC `admin_customers_list` (старые миграции) — заменён на `get_customers_list` в UI.

**Начисление** (после успешного `payOrder`): `Math.round((totalBani / 100) × accrual_rate × bonus_multiplier)`. `totalBani` уже с учётом списанных бонусов. Ошибки логируются, оплату не блокируют.

**Списание** (`redeemBonus`): из `sendPosDraftToKitchen` (POS) и `create-order.ts` (витрина).

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
- **UI** (`supply-order-dialog.tsx`): режимы `create` | `edit` | `view`. Типы — `inventory/supplies/types.ts` (`SupplyOrderViewModel`, без импорта из client-компонента). Активная поставка открывается в **edit** (редактируемые поля, «Сохранить» → `updateSupplyOrder` с confirm «пересчитает остатки»). Аннулированная — только **view**. В edit доступно аннулирование. Список — `supplies-table.tsx` (бейдж «Аннулирована»). Страница `/admin/inventory/supplies` — `force-dynamic`; вложенные `supply_order_items` нормализуются в массив (`asRelationArray`, как на semi-finished).
- `avg_cost` пересчитывается **средневзвешенно** по цене поставки (ex-VAT).
- В UI: цены без НДС и с НДС синхронно (общая VAT % по строке); в БД — ex-VAT, в g/ml через `toStoragePrice`.

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
- Actions: `getMenuItemToppingGroups` / `setMenuItemToppingGroups` (`MenuItemToppingGroupAttachment`: `topping_group_id`, `free_count`).

**Витрина — корзина / checkout** (`CartItemToppingDetails`, `CartItemCard`, `order-summary`):
- Топпинги по группам: строки `«Название ×N — X лей»`; charge per topping — `calcToppingChargesById`.
- Если вся группа бесплатна — зелёный бейдж «В комбо» у названия группы.
- **`CartItemCard`:** при `giftFreeUnits > 0` (из `giftItems` движка) — зачёркнутая цена бесплатной части + «0 лей» зелёным; частично платные строки показывают и платную сумму.

**Прочее:**
- `topping-max-selection.ts` — legacy-хелпер `nextSelectedToppingIdsWithGroupCap` (витрина, flat ids); POS больше не использует `nextSelectedByGroupWithCap`.
- `topping_recipes` — состав топпинга. RPC `save_topping_with_recipes` (параметр `p_aggregator_price_bani`; миграция `*_toppings_aggregator_price_rpc.sql`).
- В `/admin/toppings` — поле «Цена агрегатор (MDL)» в `topping-dialog.tsx`; действие «Существующий» — **копирует** топпинг в новую группу вместе со строками `topping_recipes`. Дубликаты по `name_ru`/`name_ro`/`price` в группе блокируются.

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
- `menu-item-card.tsx`, `featured-menu-section.tsx` — карточка товара
- `ProductModalRoot.tsx` — «В корзину»
- `checkout-view.tsx` — `handleBackNav` + корзина

### Layout и SEO

- `(client)/layout.tsx`: `StoreClosedModal`, `generateMetadata`, `BrandJsonLd`, `MetaPixel`, `StorefrontTopBar`, `ClientChrome`; резолв бренда по `x-brand-slug`.
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
- **Списание бонусов в checkout:** `BonusRedeemBlock` (`components/client/bonus-redeem-block.tsx`) — слайдер + строка «Списать N бонусов = −N MDL» (`t.bonus.redeemSummary`); текст итога — `var(--color-text)` (контраст на белом фоне).
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

### AuthModal

`AuthModal` — Vaul при ширине ≤1023px, shadcn Dialog на десктопе. Тексты — `t.auth.modal`. Управление — `auth-store` (`openAuth(onAuthSuccess?)`, `closeAuth`, `dismissAuth`, `fetchMe`).

### Leaflet

Компоненты с `leaflet`/`react-leaflet` подключать **только client-side** через `dynamic(..., { ssr: false })`. **Не вызывать `import('react')` внутри фабрики `dynamic`** (ломает Turbopack/HMR). Не реэкспортировать карту из barrel-файлов.

## Админка

### Layout

`AdminShell`: `TooltipProvider` + `SidebarProvider` → `AdminSidebar` (`collapsible="offcanvas"`, `variant="inset"`) + `SidebarInset`.

Активный бренд: cookie `admin-brand-slug` → `getAdminBrandId()` для брендового контента.

Корень `/admin` → `redirect('/admin/orders')`.

`AdminSidebar`: первый пункт навигации — **Аналитика** (`/admin/analytics`).

`/admin/*` без сессии → редирект на `/admin/login`. `/api/admin/*` без сессии → 401 JSON.

Независимые запросы — `Promise.all`.

### Разделы

| Маршрут | Описание |
|---|---|
| `/admin/analytics` | Дашборд KPI и графики: `getAnalyticsData` (`lib/actions/admin/analytics.ts`), `AnalyticsDashboard` (recharts). Фильтры: период 7/14/30 дней, бренд или все. Заказы `status=done`, выручка в MDL (bani/100). |
| `/admin/orders` | Метрики за сутки UTC (`getAdminOrdersTodayMetrics`) + фильтры (`status_group`, `brand_id`, `order_src`, `search`, даты — дефолт сегодня UTC) + таблица. Клик по строке → `OrderDetailSheet` через `fetchAdminOrderDetail` (service role). |
| `/admin/customers` | RSC `page.tsx` + **`CustomersPageClient`**: RPC **`get_customers_list`** (50/стр.), URL `?search=`, `?page=`. Фильтры в Popover (`components/admin/customers/customers-filters.tsx`). Таблица: клиент, регистрация, заказы (сайт+Poster), потрачено, последний заказ, бонусы → `/admin/customers/[id]`. |
| `/admin/customers/[id]` | RSC: профиль, баланс через **`getActualBalance`**, до 50 транзакций, до 20 заказов. `BonusAdjustForm` → `POST /api/admin/bonus/adjust` (тоже `getActualBalance` для `balance_after`). |
| `/admin/settings/bonus` | `bonus_settings` id=1; `updateBonusSettings` (`%` в UI → доли в БД). |
| `/admin/categories` | `menu_categories`: RU/RO, slug, `image_url`, `show_in_upsell`, `exclude_from_discounts`, `workshop`. |
| `/admin/menu` | `menu_items` + `menu_item_variants` (+ `aggregator_price_bani`). Привязка групп топпингов с `free_count` (`menu-item-dialog.tsx`). `RecipeEditorModal` (типы строк: ингредиент, п/ф, комбо; себестоимость — `product-recipe-cost.ts`; embed п/ф — FK-hint `semi_finished_items!semi_finished_items_semi_finished_id_fkey`). `?edit={id}` автооткрытие. Бейджи покрытия рецептом + **себестоимость рецепта** (MDL) из `buildMenuItemRecipeCostMap` на сервере. |
| `/admin/featured-menu` | «Популярное». |
| `/admin/toppings` | Группы + топпинги (`aggregator_price_bani`); копирование между группами; состав через `topping_recipes` (RPC `save_topping_with_recipes`). |
| `/admin/promotions` | Промо-баннеры RU/RO. |
| `/admin/discount-rules` | `discount_rules` (все бренды, без `getAdminBrandId()`). Actions: `saveRule`, `deleteRule`, `toggleRuleActive` (service role). |
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
| `/admin/inventory/supplies` | Поставки: RSC `page.tsx` + `types.ts`; модалка (`create` / `edit` / `view`) с двусторонним расчётом цен/итогов, `IngredientCombobox`; **редактирование** активных (`updateSupplyOrder`), просмотр аннулированных, аннулирование (`annulSupplyOrder` → RPC `annul_supply_order_stock`). |
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
- `menu_items` — `has_sizes` (true → цены из variants), `included_items` (JSON `{name_ru,name_ro}[]`), `category_id`, `brand_id`, `aggregator_price_bani` (nullable bani). Legacy: `is_default_condiment`, `condiment_default_qty` (не используются).
- `menu_item_variants` — `name_ru/ro`, `price` (bani), `aggregator_price_bani` (nullable bani), `sort_order`, `weight_grams`, `menu_item_id`.
- `topping_groups` (`max_selections` NULL/число), `toppings` (`aggregator_price_bani`), `topping_recipes`, `menu_item_topping_groups` (`menu_item_id`, `topping_group_id`, `free_count`).
- `promotions`, `featured_menu_items`, `promo_codes` (с `valid_channels`), `discount_rules`.
- `delivery_zones` — `polygon` JSONB `[lat,lng][]`, `color` (TEXT, HEX), `delivery_price_bani`, `night_delivery_price_bani`, `active_from`, `active_to`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `is_active`, `sort_order`, `brand_id`.
- `delivery_zone_schedules` — `zone_id`, `from_time`, `to_time`, `delivery_price_bani`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `sort_order` (миграции `*_delivery_zone_schedules.sql`, `*_delivery_zones_night_and_window.sql` для legacy-колонок зоны).
- `orders`, `order_items` — см. раздел Контракты.
- `profiles`, `otp_codes`, `customer_addresses` (`profile_id`, `label`, `address`, `entrance/floor/apartment/intercom`, `delivery_lat/lng`, `is_default`). На `profiles`: **`poster_orders_count`**, **`poster_last_order_at`** (история Kitch/Poster для списка клиентов).
- `bonus_settings`, `bonus_transactions`.
- `staff`, `shift_logs`, `courier_locations`.
- `cash_sessions`, `cash_transactions` (`expense_category_id` → `expense_categories`, legacy `category` остаётся для совместимости).
- Финансы: `expense_categories` (`variable` / `fixed` / `operational` / `commission`), `expenses` (внекассовые расходы, суммы в bani), `glovo_settlements`, `finance_settings` (single-row id=1).
- `pbx_calls` (ОАТС), `incoming_calls` (legacy MoldCell).
- Склад: `ingredient_categories`, `ingredients`, `ingredient_stock`, `stock_ledger`, `semi_finished`, `semi_finished_items` (`ingredient_id` **или** `semi_finished_ref_id` на строку состава), `product_recipes`, `product_recipe_meta`, `suppliers`, `supply_orders` (`annulled_at`), `supply_order_items`, `stock_writeoffs`, `stock_writeoff_items`, `stock_audits`, `stock_audit_items`.

### Типы

`src/types/database.ts` — `OrderStatus`, `Order`, `OrderItem`, `OrderItemTopping` (`toppings` JSONB), `MenuItem` / `MenuItemVariant` / `Topping` (`aggregator_price_bani?`), `MenuItemToppingGroup` (`free_count`), **`CustomerAddress`** (сохранённые адреса клиента для POS/API), `CashSession`, …

`src/types/customers.ts` — `CustomerRow`, `CustomerFilters`, `DEFAULT_CUSTOMER_FILTERS` (список клиентов админки).

`src/types/promotions.ts` — `DiscountRule` incl. **`max_free_items?`**, `GiftCartItem`, `DiscountEngineOutput.giftItems`.

`src/types/cart.ts` — `CartItem`, `CartTopping` (`quantity`, `topping_group_id`), `toppingGroupFreeCounts`, `toppingGroupLabels`.

`src/types/pos.ts` — `PosCartItem` (`aggregatorUnitPriceBani?`), `PosCartTopping` (`aggregator_price_bani?`, та же форма что `CartTopping` + `toppingGroupFreeCounts` на строке корзины POS).

`src/types/finance.ts` — `ExpenseCategory`, `Expense`, `GlovoSettlement`, `FinanceSettings`, `PnLData`.

`src/lib/supabase/types.ts` — частично генерированный Database (минимальные наброски). Перегенерировать через `supabase gen types` при появлении новых миграций.

### Realtime

Publication `supabase_realtime` обязательна для `orders`, `order_items`, `pbx_calls`. RLS должна разрешать чтение нужных строк ролью, которой подписывается клиент (иначе события скроются):
- `pbx_calls`: SELECT для `anon` на `cmd ∈ ('contact','event')`. Связанное чтение `profiles.name`.
- `brands` для anon на чтение `id`, `slug` (иначе join и фолбек по `brand_id` вернут пусто).

### Service role

Обход RLS — `src/lib/supabase/service-role.ts` (`createServiceRoleClient` = `createServiceSupabaseClient`). Использовать для server actions, где нужен полный доступ.

### Загрузка изображений

`POST /api/upload` → публичный bucket `menu-images`.

### Миграции

SQL в `supabase/migrations/`. Применять через Supabase MCP / CLI / dashboard. Не дублировать список файлов в этом документе.

## API endpoints

| Endpoint | Описание |
|---|---|
| `POST /api/upload` | bucket `menu-images` |
| `POST /api/auth/send-otp` | OTP 4 цифры через SMS.md |
| `POST /api/auth/verify-otp` | Проверка + cookie `storefront-session` |
| `POST /api/auth/logout` | Очистка storefront session |
| `GET /api/auth/me` | Профиль по session; `{ profile: null }` без сессии |
| `GET /api/account/orders` | Последние 10 заказов профиля (401 без сессии) |
| `PATCH /api/account/profile` | `{ name }` → `profiles.name` |
| `GET /api/bonus/settings` | Публично: `accrualRate`, `maxRedemptionRate`, `isEnabled` |
| `GET /api/bonus/balance?profileId=` | `getUserBalance`; без `profileId` → `{ balance: 0 }` |
| `GET /api/admin/bonus/settings` | Для админки (проценты ×100) |
| `POST /api/admin/bonus/adjust` | Корректировка `bonus_transactions`; `staff_id` из тела; `balance_after` через `getActualBalance` ± сумма; `amount` > 0, тип `manual_add` / `manual_deduct` |
| `GET /api/avatar/[profileId]` | SVG DiceBear thumbs |
| `POST /api/pbx/incoming` | ОАТС (`crm_token` = `PBX_WEBHOOK_TOKEN`); cmd contact/event/history |
| `POST /api/pbx-webhook` | Legacy MoldCell → `incoming_calls` |
| `POST /api/telegram` | Курьерский бот webhook (`TELEGRAM_COURIER_WEBHOOK_SECRET`) |

## Server Actions

Каталог: `src/lib/actions/`. Для брендового контента в админке — фильтр через `getAdminBrandId()`; для склада/персонала — без фильтра.

### Витрина и общие

- `check-delivery-zone.ts` — `getActiveDeliveryZones` (фильтр `isZoneAvailableNow`, `attachResolvedZoneParams`), `geocodeAddress(query, zones?)`, `reverseGeocode` (Nominatim; с зонами — viewbox + `bounded=1` + `findZoneForPoint`).
- `create-order.ts` — заказ с витрины. `order_items` из корзины (`variant_id`, `size`, `toppings` с `quantity` из `cartToppings`). Поля `bonuses_redeemed`, `profile_id`, `delivery_lat/lng` (best-effort через `geocodeAddress`). После вставки — `redeemBonus` при `bonuses_redeemed > 0`. Telegram-уведомление через `sendTelegramNotification` (общий канал, не курьерский). Адрес — одной строкой в `delivery_address`.
- `validate-promo-code.ts` — `validatePromoCode(code, subtotalBani, brandIdForOrder?)`. Витринная валидация.
- `discounts.ts` — `getActiveDiscountRules`, `resolvePromoCode`, `getStorefrontCartPricingBootstrap`.
- `account/update-profile.ts` — обновление через FormData (страница `/account` использует REST `PATCH`).
- `create-order-admin.ts` — заказ из админки.

### Админка

- `get-orders.ts` — без принудительного фильтра по `getAdminBrandId()`. Брэнд по URL.
- `update-order-status.ts`.
- `get-brands.ts`, `set-admin-brand.ts`.
- `admin/analytics.ts` — `getAnalyticsData` (KPI, день/день, топ позиций; фильтр `brandId`, `days` 7|14|30).
- `admin/bonus-settings-action.ts` — `updateBonusSettings`.
- `admin/cash-sessions.ts` — `listCashSessions`, `getCashSessionDetail`, `listStaffForFilter`, `voidCashTransaction`, `editCashTransaction`.
- `admin/finance.ts` — `getExpenseCategories`, `getFinanceSettings`, `getExpenses`, `createExpense`, `deleteExpense`, `getGlovoSettlements`, `createGlovoSettlement`, `deleteGlovoSettlement`, `computePnL`.
- `admin/customers-list.ts` — `getCustomersList`.
- `inventory/ingredient-categories.ts` — CRUD категорий (service role).
- `(admin)/admin/discount-rules/actions.ts` — `saveRule`, `deleteRule`, `toggleRuleActive` (service role).
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
- `send-pos-draft-to-kitchen.ts` — `draft`/`new`/`confirmed` → `cooking`, `cooking_started_at`; пересчёт `total`/`bonuses_redeemed` только под списание бонусов (не из каталога); `redeemBonus`.
- `accept-order-pos`, `reject-order-pos` — для `new` + `source='website'`.
- `cancel-order-pos`, `delete-draft-order-pos`.
- `assign-courier-pos.ts` — `assignCourierPos`, `changeCourierPos`. После — `sendCourierAssignmentTelegram`.
- `courier-telegram-message.ts` — `sendCourierAssignmentTelegram`, `editPreviousCourierAssignmentTelegram`, `refreshCourierOrderTelegramMessage`.
- `fetch-orders.ts` — `ORDERS_POS_SELECT`, `fetchPosOrders`, `fetchCompletedPosOrders`, `mergeOrdersPreserveBrandSlug`.
- `fetch-kds-orders.ts` — `fetchKdsCookingOrdersPos`, `fetchKdsOrderByIdPos`.
- `update-order-status-kds.ts` — `cooking → ready`.
- `customers-pos-actions.ts` — `posLookupCustomer` (профиль, **`addresses[]`**, `bonus_settings`), `posSaveCustomer`, `posSaveCustomerAddress`.
- `check-delivery-zone-pos.ts` — `checkDeliveryZoneByAddress` (возвращает `resolvedParams` при `in_zone`), `getZonesByBrandSlug` (+ `isZoneAvailableNow`, `attachResolvedZoneParams`).
- `create-order-pos.ts` — legacy one-shot создание; `items: PosCartItem[]`, `deliveryMode` incl. `aggregator`; `order_items` через `posLinePayloadFromCartItem(cartItem, isAggregator)`.
- `update-order-items.ts` — `addOrderItemsPos` / `replaceOrderItemsPos` / `updateOrderItemCompositionPos` принимают `PosCartItem[]` (или `cartItem`); `isAggregator = (delivery_mode === 'aggregator')`; insert/update через `posLinePayloadFromCartItem`. toppings JSON `{ name, price, quantity }`.

### Полезные lib (не actions)

- `lib/bonus.ts` — лояльность (витрина / POS).
- `lib/admin/get-actual-balance.ts` — `getActualBalance` для админки клиентов.
- `lib/customers.ts` — `getCustomerByPhone` (JOIN `customer_addresses`), `saveCustomer`, `saveCustomerAddress`, `setDefaultAddress`, `getDefaultAddress`. Service role.
- `lib/delivery-zone-schedule.ts` — `getActiveSchedule`, `isZoneAvailableNow`, `resolveZoneParams`, `attachResolvedZoneParams`.
- `lib/actions/admin/delivery-zone-schedules.ts` — CRUD слотов расписания зоны.
- `lib/discount-engine.ts` — `evaluateDiscounts`, `isRuleScheduleActive` (pure, без Supabase).
- `lib/order-recipe-stock-deduction.ts` — `computeIngredientTotalsForOrder`.
- `lib/inventory-units.ts`.
- `lib/ingredient-avg-cost.ts` — `parseIngredientAvgCostStorage` из embed `ingredient_stock`.
- `lib/semi-finished-cost.ts` — `computeSemiInputCostMdl`, `semiCostPerStorageUnitMdl`, `buildSemiFinishedCatalogMap` (рекурсивная себестоимость п/ф по составу).
- `lib/pos/split-composite-delivery-address.ts` — `splitCompositeDeliveryAddress`, `posCheckoutAddressFieldsFromOrder` (раскладка подъезд/этаж/кв. из строки `delivery_address`; POS «Детали» и адрес в Telegram курьеру).
- `lib/product-recipe-cost.ts` — `buildProductRecipeCostContext`, `enrichProductRecipeCostContext`, `productRecipeLineCostMdl`, `computeMaterialRecipeCostMdl`, `computeReferencedMenuItemRecipeCostMdl`, `buildMenuItemRecipeCostMap`, `resolveMenuRefRecipeVariantFilter` (себестоимость техкарт: ингредиент + п/ф + комбо).
- `lib/recipe-editor-qty.ts`, `lib/recipe-composition-row-updates.ts`, `lib/recipe-composition-waste.ts`, `lib/product-recipe-ingredient-qty.ts`, `lib/recipe-composition-types.ts` (`RecipeCompositionSemi.cost_per_storage_unit`).
- `lib/topping-pricing.ts` — `calcToppingGroupCharge`, `calcToppingChargesById`, `getFreeUnitsRemaining`, `formatStorefrontToppingGroupHeader`.
- `lib/format-mdl.ts` — `formatMdl` для UI сумм в MDL по значениям в bani.
- `lib/topping-max-selection.ts`, `lib/cart-toppings.ts`, `lib/cart-helpers.ts` (`getCartItemToppingDisplayGroups`, `getCartItemSizeLabel`).
- `lib/pos-cart-toppings.ts` — `posAddTopping`, `posRemoveTopping`, `migratePosCartToppingsFromLegacy`, `posCartToppingsConfigKey`.
- `lib/pos-cart-helpers.ts` — `calcPosToppingsCharge(..., isAggregator)`, `getPosCartItemUnitPriceBani(item, isAggregator)`, `posLinePayloadFromCartItem(item, isAggregator)`, `posToppingsPayloadForDb(..., isAggregator)`, `getPosCartItemToppingDisplayLines`.
- `lib/pos/menu-item-modal-row.ts` — `POS_MENU_ITEM_FOR_MODAL_SELECT` (вкл. `aggregator_price_bani`), `posMenuRowForModal`, `posVariantsFromMenuEmbed`.
- `components/topping-stepper-card.tsx` — общая карточка топпинга (витрина + POS).
- `components/pos/order-form/pos-address-cards.tsx` — карточки сохранённых адресов на шаге «Детали» POS.
- `components/admin/customers/` — `customers-page-client.tsx`, `customers-filters.tsx`, `customers-table.tsx`.
- `components/admin/cash-sessions/cash-transaction-actions.tsx` — void/edit кассовых транзакций в детали смены.
- `components/admin/finances/period-filter.tsx` — общий compact Popover-фильтр периода для `/admin/finances`, `/admin/finances/expenses`, `/admin/finances/glovo`.
- `components/client/cart/storefront-cart-pricing.ts` — `evaluateStorefrontCartDiscount`, `allocateGiftFreeUnitsByCartLineId`.
- `lib/data/storefront-item-toppings.ts` — `fetchStorefrontMenuItemToppingGroups` (`free_count` с `menu_item_topping_groups`; select включает `aggregator_price_bani` у топпингов).
- `lib/order-item-size-display.ts`.
- `lib/storefront-delivery-display.ts`, `lib/storefront-pickup-location.ts`, `lib/storefront-account-path.ts`.
- `lib/brand-phone.ts` — `getBrandPhone(slug)`.
- `lib/seo/brand-seo.ts`, `lib/seo/menu-item-image-alt.ts`.
- `lib/pbx/diversion-brand-slug.ts`.
- `lib/pos/alert-sound.ts`, `kds-wakeup.ts`, `scheduled-slots.ts`, `split-composite-delivery-address.ts`, `pos-brand-slug-cookie.ts`, `menu-item-modal-row.ts`, `use-incoming-call.ts`.
- `lib/rawbt.ts` — RawBT intent: текст, открытие денежного ящика.
- `lib/receipt-print.ts` — snapshot offscreen-чека и inline-печать PNG через RawBT.
- `components/ReceiptTemplate.tsx` — React-шаблон термочека для `printReceipt`.
- `hooks/use-store-open.ts`, `hooks/use-persist-store-hydration.ts`, `lib/store-hours.ts` — часы витрины по `BrandConfig` (Chisinau).
- `lib/store/cart-store`, `store-closed-store`, `auth-store`, `pos-order-from-call-bridge`, `pos-menu-cache`, `language-store`, `delivery-store` (fee через `resolvedParams.delivery_price_bani`).
- `lib/supabase/server.ts`, `client.ts`, `service-role.ts`.
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

# SMS-шлюз для OTP
SMS_MD_API_KEY=
SMS_MD_SENDER=

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
```

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

## Deploy

Корневой `vercel.json`: **301-редиректы** `/ru`, `/ru/*`, `/ro`, `/ro/*` → корень сайта (`permanent: true`). Язык витрины — в localStorage (`lang`), не в URL.

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
- Применить на remote Supabase миграции: **`get_customers_list`** (`*_get_customers_list.sql`, колонки Poster на `profiles`); **`cash_transactions.edited_at`**, **`edited_by_user_id`** (если edit в админке падает); склад поставок — `*_apply_supply_stock_rpc.sql`, `*_revert_supply_stock_and_update.sql`, **`annul_supply_order_stock`**.
- Подключить списание ингредиентов в `payOrder` через `computeIngredientTotalsForOrder`.
- Убрать временные RawBT test-кнопки с `/pos` и diagnostic `alert` из `printReceipt` после стабилизации печати на терминале.
- Подпись «Позвонить …» в `storefront.ts` под бренд (или оставить динамику в `aria-label` через `getBrandCallLabel`).
