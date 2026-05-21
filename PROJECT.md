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
| UI extras | Sonner, Vaul, Swiper, cmdk, recharts, DiceBear (`@dicebear/core`, `@dicebear/thumbs`) |

ESLint: `next/core-web-vitals`, `next/typescript`; `@typescript-eslint/no-explicit-any: warn`.

## Структура

```
src/
├── app/
│   ├── (client)/        # витрина, checkout, account
│   ├── (admin)/admin/   # админка
│   ├── pos/             # POS + KDS
│   ├── api/             # REST endpoints
│   ├── robots.ts, sitemap.ts
│   ├── globals.css
│   └── layout.tsx       # root, <html lang="ro">
├── brands/              # BrandConfig + host→brand
├── components/
│   ├── client/          # витрина, корзина, checkout, auth
│   ├── admin/           # AdminShell, sidebar, analytics, inventory, cash-sessions
│   ├── pos/             # PosAppShell, OrderForm, KdsScreen и др.
│   ├── store-closed-modal.tsx  # оверлей «магазин закрыт» (витрина)
│   ├── seo/JsonLd.tsx
│   ├── MetaPixel.tsx
│   └── ui/              # shadcn
├── hooks/
│   └── use-store-open.ts       # часы работы витрины по BrandConfig (Europe/Chisinau)
├── lib/
│   ├── actions/         # server actions (см. раздел Server Actions)
│   ├── data/            # storefront fetchers
│   ├── store/           # Zustand stores (cart, delivery, store-closed, …)
│   ├── i18n/, pos/, pbx/, seo/, telegram/, supabase/
│   ├── bonus.ts, customers.ts, discount-engine.ts
│   ├── store-hours.ts, cart-toppings.ts, cart-helpers.ts, topping-pricing.ts, topping-max-selection.ts
│   ├── delivery-zone-schedule.ts  # слоты расписания зоны (Europe/Chisinau)
│   ├── actions/admin/analytics.ts, delivery-zone-schedules.ts
│   ├── inventory-units.ts, recipe-*.ts
│   ├── order-recipe-stock-deduction.ts
│   └── ...
├── types/               # database, cart, pos, promotions
├── scripts/
└── middleware.ts
```

## Контракты

### Money & единицы

- **Заказы в БД — integer bani** (`orders.total`, `price`, `discount`, `delivery_fee`, `bonuses_redeemed`, все `*_bani`). В UI — MDL.
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

`order_items`: `variant_id` (FK `menu_item_variants`, nullable), `size` (текстовый snapshot подписи варианта; старые строки могут иметь `s`/`l`), `toppings` (JSONB: `{ name, price, quantity }[]`, тип `OrderItemTopping`), `is_gift`, `gift_rule_id`.

### Multi-brand: что брендовое, что общее

**Брендовое** (фильтр по `brand_id`, для админки — через `getAdminBrandId()` из cookie `admin-brand-slug`): `menu_categories`, `menu_items`, `menu_item_variants`, `topping_groups`, `toppings`, `menu_item_topping_groups`, `promotions`, `featured_menu_items`, `promo_codes`, `discount_rules`, `delivery_zones`, `orders` (на витрине). На витрине бренд резолвится через `getBrand()` / `getBrandId()`; на админке через cookie.

**Общее для всех брендов** (без фильтра по `getAdminBrandId()`): `staff`, `shift_logs`, `cash_sessions`, `cash_transactions`, склад целиком (`ingredients`, `ingredient_categories`, `ingredient_stock`, `semi_finished`, `semi_finished_items`, `product_recipes`, `suppliers`, `supply_orders` (+ `annulled_at`), `supply_order_items`, `stock_writeoffs`, `stock_audits`, `stock_ledger`), `profiles`, `customer_addresses`, `bonus_settings`, `bonus_transactions`.

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

Таблицы: `cash_sessions` (status `open`/`closed`, `opened_by_staff_id`, `closed_by_staff_id`, `discrepancy_reason`), `cash_transactions` (типы: `opening`, `order_payment`, `expense`, `income`, `encashment`; denormalized `order_delivery_mode`, `order_brand_id`, `encashment_destination`; voiding через `voided_at`, `voided_by_staff_id`, `void_reason`).

Server actions — `src/lib/actions/pos/cash-session.ts`: `openCashSession`, `getCashSession`, `getExpectedInDrawerBani`, `getActiveOrdersCountForShift`, `createCashTransaction`, `closeCashSession`, `payOrder`.

**Инварианты `payOrder`:**

- Разрешён **только из** `status='delivery'` ИЛИ (`status='ready'` И `delivery_mode ∈ {pickup, aggregator}`).
- Атомарно проставляет `paid_at`, `status='done'`, `cash_session_id` (UPDATE ожидает текущий `delivery` или `ready`).
- В `cash_transactions` всегда denormalized `order_delivery_mode`, `order_brand_id`.
- **Glovo (`aggregator_card`): строка в `cash_transactions` НЕ создаётся**; в `orders` обновляется `payment_method` и `cash_session_id`.
- Наличные Glovo: одна строка `order_payment` как обычно.
- `mixed`: **две строки** `cash_transactions` (`order_payment`: нал + карта) по полям `orders.cash_amount` и `card_amount`; обе должны быть > 0, сумма равна «К оплате» (±1 бан).
- После успешной записи — `processBonusAccrualOnOrderDone(profileId, orderId, totalBani, bonus_multiplier ?? 1)` из `bonus.ts`. Ошибки начисления логируются, оплату не блокируют.

**Закрытие смены (`closeCashSession`):** обязательный `discrepancyReason` ≥3 непробельных символов при расхождении >50 MDL. Незавершённые заказы смены — предупреждение, не блок. Строки с `voided_at` исключены из агрегатов баланса.

Read-only админка: `src/lib/actions/admin/cash-sessions.ts` (`listCashSessions`, `getCashSessionDetail`, `listStaffForFilter`).

### KDS (/pos/kds)

- Список — все заказы `status='cooking'`, без фильтра по бренду. Выборка через константу `KDS_ORDER_QUERY_SELECT` в `components/pos/kds/types.ts` (с `menu_items(category_id, menu_categories(workshop))`).
- **Realtime:** два канала на anon-клиенте — `kds-orders` (таблица `orders`) и `kds-order-items` (таблица `order_items`), `postgres_changes`, `event:*`, без server-side фильтров. Полная перезагрузка через `reloadCookingOrders`.
- Дополнительно: периодический `reloadCookingOrders` каждые **30 с** + при `visibilitychange` / `online` / `window.focus`. Отдельный `wakeTick` каждые **60 с** пересчитывает `isKdsCardActive` (lib/pos/kds-wakeup.ts) — «спящие» карточки предзаказа.
- «Готово» (`cooking → ready`): `update-order-status-kds.ts`, проставляет `ready_at`.
- **Фильтр цехов:** `menu_categories.workshop` ∈ `operator`, `pizza`, `kebab`, `sushi`. localStorage ключ `kds_workshops` (JSON-массив). `workshop=null` у категории — строка видима всегда. Заказ без видимых после фильтра позиций не рендерится.
- **Звуки:** `src/lib/pos/alert-sound.ts`. `playPosStatusUpdateSound()` при появлении нового `id` в `cooking` (вне `knownOrderIdsRef`). Bell-кнопка в шапке нужна для **unlock WebAudio на Chrome/Android**.

### POS (главная страница и Realtime)

- `src/app/pos/page.tsx`: слева `OrdersPanel` (24 ч активных + 50 «Выданных»; `ORDERS_POS_SELECT` в `src/lib/pos/fetch-orders.ts`); справа — `idle` (выбор типа: доставка / навынос / Glovo), `wizard` (мастер `OrderForm`) или `detail` (только `done`).
- При монтировании страница один раз грузит `brands(id, name, slug)`, склеивает с `BrandConfig` в `wizardBrands` (`PosWizardBrandOption`), затем предзагружает меню всех брендов в `usePosMenuCache`.
- **Realtime POS:** два канала в `orders-panel.tsx` на anon-клиенте — `pos-orders` и `pos-order-items`, `postgres_changes`, `event:*`. На каждое событие — `reloadOrders()` → `fetchPosOrders` / `fetchCompletedPosOrders` + `mergeOrdersPreserveBrandSlug` (сохраняет `brand_slug` если ответ пришёл с пустым slug при том же `brand_id`). При `INSERT` в `orders` — `playPosNewOrderSound()`.
- Левая `OrderCard` — **только просмотр**: статус и курьер read-only. Все переходы статусов делаются из мастера/деталки (`update-order-status-kds`, `assign-courier-pos`, `payOrder`).
- Принять / отклонить заказ с сайта (`new` + `source='website'`) — только из `OrderDetail` (`accept-order-pos`, `reject-order-pos`).

### Мастер заказа (OrderForm)

Шаги: **Бренд → Оформление (меню + корзина) → Детали**. Привязан к `orderId`; `key={panel.orderId}` меняется только при явной смене заказа.

**Создание черновика** — `createDraftOrderPos`:
- `delivery` / `pickup` — обычный заказ.
- `aggregator` — Glovo: ставит `aggregator='glovo'`, `payment_method='aggregator_card'`, `prep_deadline_at` = +15 мин.
- Из входящего звонка: `createDraftOrderPos({brandSlug, userPhone, profileId, userName})` — резолв `brand_id`, открытие мастера на шаге 2.

**Меню в мастере:** `usePosMenuCache` (на время браузерной POS-сессии: категории, items с вариантами и группами топпингов, индексы). Fallback — Supabase запрос с `POS_MENU_ITEM_FOR_MODAL_SELECT`. Cookie `pos-brand-slug` обновляется при выборе бренда (синхронизация с KDS).

**Корзина — optimistic:**
- `addCartItem`, `updateQty`, `removeLine`, `saveCartLineFromModal`, `handleClearCart` сначала меняют локальный `cart` (`applyOptimisticCart`) → синхронно обновляют карточку слева через `updateOrderLocalState` (item_count, total, discount, delivery_fee, bonuses_redeemed) → в фоне зовут server actions (`addOrderItemsPos`, `updateOrderItemQuantityPos`, `removeOrderItemPos`, `updateOrderItemCompositionPos`, `replaceOrderItemsPos`).
- На ошибке — `rollbackOptimisticCart(snapshot, message)` + Sonner.
- Realtime подписки — финальная сверка.

**Шаг «Детали»:**
- Контакт: телефон **обязателен** для не-агрегатора, имя необязательно. Для Glovo контакты/адрес не требуются (Zod + `detailsArePersistable`).
- Адрес при `delivery`: `delivery_address` + структурные `address_*`; зона через `checkDeliveryZoneByAddress` (Nominatim + viewbox по полигонам активных зон бренда, `bounded=1`, `countrycodes=md`, `findZoneForPoint`).
- Время доставки (`ScheduledTimePicker`, `generateScheduledSlots`): `asap` или `HH:MM` → `orders.scheduled_time`. Слоты по `BrandConfig.openHour/closeHour`.
- Оплата: `cash` / `card` / `mixed`. Сохранение — сразу по клику (для `mixed` — только когда обе суммы согласованы с итогом, защита DB constraint).
- Дополнительно: `comment` (общий) и опционально `kitchen_note` (только для KDS).
- **Lookup клиента** (`posLookupCustomer`): по телефону, debounce 500 мс + дедупликация. Возвращает профиль, адреса, баланс бонусов, `bonus_settings.max_redemption_rate` (id=1, дефолт 0.3 при сбое).
- **Списание бонусов:** поле при найденном клиенте, `total > 0`, `balance > 0`. Потолок = `floor(min(balance, totalBani/100 × max_redemption_rate))`. `totalBani` после скидок и доставки.
- Все правки на «Деталях» уходят через `updateOrderDetailsPos` с **debounce 600 мс** (контакт, адрес, координаты, comment, kitchen_note, profile_id, скидки, промо, синхронизация подарочных строк).

**Скидки в мастере:** `getActiveDiscountRules` (trigger=`auto`) загружается на сервере; промокод через `PromoPanel` + `resolvePromoCode` (`discounts.ts`); финальный расчёт через `evaluateDiscounts` (`src/lib/discount-engine.ts`) с `excludedCategoryIds` из `usePosMenuCache`. Для заказов с сайта с непустым `promo_code` — флаг `skipSeedResolve` (быстрый показ без асинхронного `resolvePromoCode`).

**Меню `⋯` мастера:** «Сделать доставкой» / «Сделать навыносом» (`updateOrderDeliveryModePos` — сбрасывает `aggregator`, `prep_deadline_at`, `scheduled_time` при переходе на pickup; нормализует `aggregator_card → cash`), «Очистить корзину», «Закрыть заказ» (`cancelOrderPos`).

**«Отправить бегунок»** — `sendPosDraftToKitchen`:
- Действует для `draft` / `new` / `confirmed` → `cooking`. Идемпотентно: уже в `cooking` — успех с тем же id.
- Проставляет `cooking_started_at`, `updated_at`. Уменьшает `total` на `floor(bonus_points × 100)` bani, ставит `bonuses_redeemed`.
- Затем `redeemBonus` из `lib/bonus.ts` (если `bonuses_redeemed > 0` и есть `profile_id`). Ошибки только в `console.error`, заказ не откатывается.
- Мастер остаётся открытым на том же `orderId`.

**«Назначить курьера»** — только из мастера, шаг «Оформление»:
- Условие: `status='ready'` + `delivery_mode='delivery'`. Glovo (`aggregator`) — курьер не назначается.
- Гейт `courierButtonGate`: для обычной доставки нужны `user_phone` И `delivery_address`; для pickup адрес не нужен. Без них кнопка disabled, модалка не открывается.
- `assignCourierPos`: `status='delivery'`, `courier_id`, `courier_assigned_at`, Telegram-карточка (см. раздел Telegram).
- «Сменить» в `delivery` — модалка та же, режим `reassign`: старая карточка → `editMessageText "передан другому"`, новый курьер получает новую пару сообщений.

**Шаг «Бренд»:** при уходе со шага в фоне зовётся `persistBrandOrError` (`updateOrderBrandPos`), без ожидания. При переходе со шага 2 на 1 или 3 — `persistCartToServer` (`replaceOrderItemsPos`) вызывается только если отпечаток корзины изменился (`cartFingerprint` vs `lastSyncedCartFingerprintRef`).

### Glovo (delivery_mode='aggregator')

- Создание: `createDraftOrderPos({deliveryMode:'aggregator'})` → `aggregator='glovo'`, `payment_method='aggregator_card'`, `prep_deadline_at` +15 мин.
- В мастере на «Деталях»: только блок «Заказ Glovo», оплата (наличные / `aggregator_card`), `comment`. Контакты и адрес скрыты. `runDetailsSaveToServer` передаёт `deliveryAddress=undefined`, `delivery_lat/lng=null`.
- Оплата по `payOrder` сразу из `ready` (без перехода в `delivery`).
- Карта Glovo → строка в `cash_transactions` не пишется (см. инварианты `payOrder`).
- При смене режима на не-aggregator: `updateOrderDeliveryModePos` сбрасывает `aggregator`, `prep_deadline_at`, нормализует `aggregator_card → cash`.

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
- Редактирование позиций: `POS_MENU_ITEM_FOR_MODAL_SELECT`, `posMenuRowForModal`, `PosProductModal`. Минус при qty=1 снимает строку.

### POS — прочее

- **Высота:** `PosAppShell` — `h-screen` + `overflow-hidden`; scrolls только внутри панелей.
- **Cмены курьеров:** через **отдельного** Telegram-бота. `POST /api/telegram`, таблица `courier_locations`, команды `/shift_start`, `/shift_end`, привязка по deep-link из `/admin/staff` (`generateTelegramLink`, `TELEGRAM_COURIER_BOT_USERNAME` без `@`).

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
  1. `sendMessage` — карточка заказа (оплата с 💳/💵, сумма 💰).
  2. `sendLocation` с `reply_to_message_id` к карточке, если есть координаты (иначе `withResolvedDeliveryCoords` + `checkDeliveryZoneByAddress`).
  3. В `orders` пишутся `courier_tg_chat_id`, `courier_tg_message_id` (**только текстовая карточка**, для `editMessageText`), `courier_tg_message_updated_at`.
- При смене курьера: старая карточка правится через `editPreviousCourierAssignmentTelegram`, новому курьеру — новая пара.
- Обновления (`refreshCourierOrderTelegramMessage`) после `update-order-items` и `update-order-details-pos` в `delivery`: `editMessageText` карточки; при `reason='details'` дополнительно `sendLocation`. Короткое update-notice через `sendMessage` — **не чаще 1/мин** (throttle по `courier_tg_message_updated_at`).
- Регистрация webhook: `npm run setup:telegram` (`scripts/setup-telegram-webhook.ts`, требует `NEXT_PUBLIC_APP_URL`).

## Скидки и лояльность

### Движок скидок

`src/lib/discount-engine.ts`: чистая функция `evaluateDiscounts(input)` + `isRuleScheduleActive`. Без Supabase.

Типы эффектов (`src/types/promotions.ts`): `item_percent`, `order_percent`, `order_fixed`, `cheapest_item_free`, `free_delivery`, `bonus_multiplier`, подарки.

`DiscountEngineInput.excludedCategoryIds` — категории `menu_categories.exclude_from_discounts`. Не участвуют в `item_percent`, `order_percent`, `order_fixed`, `cheapest_item_free`. На `free_delivery`, `bonus_multiplier`, подарки — не влияют.

Источники: таблица `discount_rules` (`trigger='auto'` или `promo`) + `promo_codes` (legacy, через синтетическое правило в `resolvePromoCode`).

В `orders` сохраняется: `discount`, `discount_rules_applied` (JSON применённых правил), `promo_code`, `delivery_fee`, `bonus_multiplier`. Подарочные строки — `order_items.is_gift` + `gift_rule_id`.

Bootstrap для витрины — `getStorefrontCartPricingBootstrap` в `discounts.ts`: авто-правила, `excludedDiscountCategoryIds`, `storefrontExcludedDiscountCategories` (с именами категорий для подсказок).

Сборка корзины витрины — `src/components/client/cart/storefront-cart-pricing.ts` (`CartItemForEngine` + `evaluateDiscounts`). Подсказки: `storefront-discount-excluded-notice.tsx`, `storefront-promo-excluded-warning.tsx`.

В POS-мастере: `mergePersistedWebsitePromoDiscount` подмешивает сохранённое `listOrder.promo_code` / `discount` пока движок ещё не дал полный выход.

### Лояльность

Таблицы: `bonus_settings` (id=1; `accrual_rate`, `max_redemption_rate`, `is_enabled`, `updated_at`), `bonus_transactions` (`profile_id`, `amount`, `balance_after`, `type`, `created_by`).

Lib: `src/lib/bonus.ts`. Все функции — service role (`createServiceSupabaseClient`).

- `getUserBalance(profileId)` — последняя `balance_after` в `bonus_transactions` (**используется на витрине и в POS**).
- В админке `/api/admin/bonus/adjust` баланс считается как `SUM(amount)`. Может расходиться с `getUserBalance`, если знаки в истории смешаны.
- `getBonusSettings()`, `manualAdjust`, `accrueBonus`, `redeemBonus`, `processBonusAccrualOnOrderDone(profileId, orderId, totalBani, multiplier?)`.

**Начисление** (после успешного `payOrder`): `Math.round((totalBani / 100) × accrual_rate × bonus_multiplier)`. `totalBani` уже с учётом списанных бонусов. Ошибки логируются, оплату не блокируют.

**Списание** (`redeemBonus`): из `sendPosDraftToKitchen` (POS) и `create-order.ts` (витрина).

Кэшбек **единый для всех брендов** (5% по умолчанию).

## Склад

### Журнал движений (stock_ledger)

Поля: `ingredient_id`, `movement_type`, `reference_type`, `reference_id`, `quantity_delta`, `cost_per_unit`, `note`, `created_at`.

`movement_type` (CHECK в миграции): `supply`, `sale`, `writeoff`, `audit` / `audit_adjustment`, `manual`.
`reference_type`: `supply_order`, `stock_writeoff`, `stock_audit`.

### Поставки (supply_orders)

- `supply_order_items.received_qty` — nullable. Если null, считается равным `quantity`.
- `supply_orders.annulled_at` — timestamptz, NULL = активная поставка. Аннулирование не удаляет строки.
- `createSupplyOrder` (`inventory/supplies/actions.ts`): вставка заказа и строк, затем пополнение `ingredient_stock` и `stock_ledger` по **`received_qty ?? quantity`**.
- `annulSupplyOrder(orderId)` (service role): откат остатков и `avg_cost` (обратное средневзвешенное), `stock_ledger` (`movement_type='manual'`, `reference_type='supply_order'`, отрицательный `quantity_delta`, note «Аннулирование поставки»), затем `annulled_at`. Блокируется при недостатке остатка или если уже аннулирована. UI: кнопка в `supply-order-dialog` (режим view), бейдж в `supplies-table`.
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
- `ingredients.waste_percent` (0–100): в техкарте нетто = брутто × (1 − %/100).
- `product_recipe_meta`: `output_qty`, `output_unit` (уникальность по `menu_item_id` + `variant_id`).
- Расчёт суммарного списания по заказу: `src/lib/order-recipe-stock-deduction.ts` (`computeIngredientTotalsForOrder`). Вложенные комбо разворачиваются на **одну ступень**.
- **Списание ингредиентов в `payOrder` пока не подключено.**

### Топпинги

- `topping_groups.max_selections`: NULL = без лимита; число ≥1 — **сумма `quantity` по группе** в одной строке корзины/заказа.
- `menu_item_topping_groups.free_count` (integer, default 0): сколько **единиц** топпингов из группы бесплатны для конкретной позиции меню. Стратегия цены — **самые дёшевые единицы бесплатны первыми** (`calcToppingGroupCharge` в `src/lib/topping-pricing.ts`). `0` = все платные.

**Витрина — модель корзины** (`src/types/cart.ts`):
- `CartTopping`: `id`, `name_ru/ro`, `price` (bani/шт), `quantity`, `topping_group_id`.
- `CartItem`: `cartToppings[]`, `toppingGroupFreeCounts` (Record groupId → free_count), `toppingGroupLabels` (имена групп для UI корзины), legacy `selectedToppingIds` (синхронизируется из `cartToppings` через `syncCartItemToppingFields`).
- Store: `addTopping` / `removeTopping` (`cart-store.ts`); лимит группы — `getTotalQuantityInGroup` (`cart-toppings.ts`).
- Цена строки: `getCartItemPrice` → `calcToppingGroupCharge` по группам (`cart-helpers.ts`); legacy persist без `cartToppings` — `migrateCartToppingsFromLegacy`.

**Витрина — модалка товара** (`ProductModalRoot`, `ToppingCard`):
- Степпер количества (+/−) вместо чекбоксов; заголовок группы — «выбрано N из M» + текст бесплатных единиц (`formatStorefrontToppingGroupHeader`, `getFreeUnitsRemaining`).
- При `freeUnitsRemaining > 0` в строке топпинга — зелёная метка «Бесплатно»; итог кнопки «В корзину» — через `calcToppingGroupCharge` по `StorefrontMenuItemToppingGroup.free_count`.
- При добавлении в корзину передаются `toppingGroupFreeCounts` и `toppingGroupLabels` из секций модалки.

**Витрина — корзина / checkout** (`CartItemToppingDetails`, `CartItemCard`, `order-summary`):
- Топпинги по группам: строки `«Название ×N — X лей»`; charge per topping — `calcToppingChargesById`.
- Если вся группа бесплатна — зелёный бейдж «В комбо» у названия группы.

**Админка — привязка групп к позиции** (`menu-item-dialog.tsx`):
- Чекбокс группы + поле «Бесплатных единиц» (min 0); helper: «0 = все платные».
- Бейдж «N бесплатно» у прикреплённой группы при `free_count > 0`.
- Actions: `getMenuItemToppingGroups` / `setMenuItemToppingGroups` (`MenuItemToppingGroupAttachment`: `topping_group_id`, `free_count`).

**Прочее:**
- POS: `nextSelectedByGroupWithCap` — отдельная модель по группам (плоский toggle, без quantity/free_count на витрине).
- `topping_recipes` — состав топпинга. RPC `save_topping_with_recipes`.
- В `/admin/toppings` действие «Существующий» — **копирует** топпинг в новую группу вместе со строками `topping_recipes`. Дубликаты по `name_ru`/`name_ro`/`price` в группе блокируются.

## Витрина

### i18n

- Языки: `ru`, `ro`. **DEFAULT_LANG = `ro`** (`src/lib/i18n/storefront.ts`).
- persist key `lang` в localStorage. `<html lang="ro">` по умолчанию; `ClientChrome` синхронизирует `document.documentElement.lang` при смене.
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
- POS при открытии мастера разрезает через `posCheckoutAddressFieldsFromOrder` (`split-composite-delivery-address.ts`) если все четыре поля пусты. Извлекает Scara / Etaj / Apartament / Interfon (плюс RU/EN аналоги: подъезд/этаж/квартира/домофон, entrance/floor/apartment/intercom). Если хоть одно поле уже заполнено — строка не режется.
- Точка самовывоза bd. Dacia 27: `storefront-pickup-location.ts`.
- Меню для апсейла LOSOS использует `menu_categories.show_in_upsell`.
- Storefront-разработка: использовать `storefront-modal-*`, `storefront-checkout-*`, `storefront-input` вместо локальных цветов.
- Доставка: `delivery-store` + `getStorefrontDeliveryLineDisplay` (`storefront-delivery-display.ts`); fee из `getDeliveryFeeBani` → `selectedZone.resolvedParams`. Модалка адреса — `DeliveryRoot` / `getActiveDeliveryZones` (зоны уже отфильтрованы по `isZoneAvailableNow`).
- Корзина: `cart-store` (`CART_STORAGE_KEY` = `kitch-cart` в persist; брендовые ключи в `BrandConfig.cartKey` / `deliveryKey` — см. TODO). `cartToppings` + legacy `selectedToppingIds` синхронизируются при записи; `toppingGroupFreeCounts` / `toppingGroupLabels` — snapshot при добавлении из модалки. Детали топпингов в UI — `CartItemToppingDetails`.
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
| `/admin/customers` | RPC `admin_customers_list(search_q)`; поиск `?q=`. |
| `/admin/customers/[id]` | RSC: профиль, баланс (`SUM(amount)`), до 50 транзакций, до 20 заказов. `BonusAdjustForm` → `POST /api/admin/bonus/adjust`. |
| `/admin/settings/bonus` | `bonus_settings` id=1; `updateBonusSettings` (`%` в UI → доли в БД). |
| `/admin/categories` | `menu_categories`: RU/RO, slug, `image_url`, `show_in_upsell`, `exclude_from_discounts`, `workshop`. |
| `/admin/menu` | `menu_items` + `menu_item_variants`. Привязка групп топпингов с `free_count` (`menu-item-dialog.tsx`). `RecipeEditorModal` (типы строк: ингредиент, п/ф, комбо). `?edit={id}` автооткрытие. Бейджи покрытия рецептом. |
| `/admin/featured-menu` | «Популярное». |
| `/admin/toppings` | Группы + топпинги; копирование между группами; состав через `topping_recipes` (RPC). |
| `/admin/promotions` | Промо-баннеры RU/RO. |
| `/admin/discount-rules` | `discount_rules` (все бренды, без `getAdminBrandId()`). Actions: `saveRule`, `deleteRule`, `toggleRuleActive` (service role). |
| `/admin/promo-codes` | `promo_codes`. |
| `/admin/staff` | `staff` + PIN (`bcryptjs`); deep-link Telegram для курьеров. Service role. |
| `/admin/staff/shifts` | `shift_logs` + join `staff` + подсчёт доставленных (`orders.status=done`, `courier_id`, `delivered_at` в интервале). |
| `/admin/delivery-zones` | `delivery_zones` + nested `delivery_zone_schedules`: полигоны Leaflet Draw, color, базовая цена/минималка/время, слоты расписания в редакторе. Actions: `createDeliveryZone`, `updateDeliveryZone`, `deleteDeliveryZone`; слоты — `createSchedule`, `updateSchedule`, `deleteSchedule`. |
| `/admin/finance/cash-sessions` | Список смен (фильтры даты/staff/status, до 200; агрегаты по `cash_transactions` + Glovo card из `orders`). |
| `/admin/finance/cash-sessions/[id]` | Деталь — scaffold (данные через `getCashSessionDetail`). |
| `/admin/finance/ledger` | `stock_ledger`, до 200 последних; фильтр по `movement_type` на клиенте; service role. |
| `/admin/inventory/stock` | Остатки (read-only); фильтр «Все/В наличии/Нет» на клиенте; единицы кг/л/шт. |
| `/admin/inventory/suppliers` | Поставщики (CRUD без бренда; удаление с проверкой `supply_orders`). |
| `/admin/inventory/ingredient-categories` | `ingredient_categories`; при удалении категории — `category_id=NULL` у связанных ингредиентов. |
| `/admin/inventory/ingredients` | `ingredients` + `ingredient_stock`. Фильтр категории: клиент при <500 строк (`INGREDIENT_SERVER_FILTER_THRESHOLD`), сервер при ≥500 (`?category=`). Поле `waste_percent`. |
| `/admin/inventory/semi-finished` | Полуфабрикаты; диалог состава работает напрямую в г/мл/шт. |
| `/admin/inventory/tech-cards` | Read-only обзор себестоимости. Ссылка «Открыть в меню» → `/admin/menu?edit={id}`. |
| `/admin/inventory/supplies` | Поставки с `received_qty`; просмотр/аннулирование (`annulSupplyOrder`, `annulled_at`). |
| `/admin/inventory/writeoffs` (+ `/new`) | Списания. |
| `/admin/inventory/audits` (+ `/[id]`) | Инвентаризации (создание + карточка с подтверждением). |

Единое поле поиска для всех inventory-таблиц — `InventorySearch` (`src/components/admin/inventory-search.tsx`); клиентский фильтр поверх данных, **кроме** фильтра категории на `/admin/inventory/ingredients` при ≥500 строк (сервер).

## Данные и БД

### Брендовое и общее

См. раздел «Multi-brand: что брендовое, что общее».

### Основные таблицы

- `brands` — slug, name, UUID.
- `menu_categories` — `name_ru/ro`, slug, `image_url`, `is_active`, `sort_order`, `is_condiment` (legacy), `show_in_upsell`, `exclude_from_discounts`, `workshop` (KDS-фильтр).
- `menu_items` — `has_sizes` (true → цены из variants), `included_items` (JSON `{name_ru,name_ro}[]`), `category_id`, `brand_id`. Legacy: `is_default_condiment`, `condiment_default_qty` (не используются).
- `menu_item_variants` — `name_ru/ro`, `price` (bani), `sort_order`, `weight_grams`, `menu_item_id`.
- `topping_groups` (`max_selections` NULL/число), `toppings`, `topping_recipes`, `menu_item_topping_groups` (`menu_item_id`, `topping_group_id`, `free_count`).
- `promotions`, `featured_menu_items`, `promo_codes` (с `valid_channels`), `discount_rules`.
- `delivery_zones` — `polygon` JSONB `[lat,lng][]`, `color` (TEXT, HEX), `delivery_price_bani`, `night_delivery_price_bani`, `active_from`, `active_to`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `is_active`, `sort_order`, `brand_id`.
- `delivery_zone_schedules` — `zone_id`, `from_time`, `to_time`, `delivery_price_bani`, `min_order_bani`, `free_delivery_from_bani`, `delivery_time_min`, `sort_order` (миграции `*_delivery_zone_schedules.sql`, `*_delivery_zones_night_and_window.sql` для legacy-колонок зоны).
- `orders`, `order_items` — см. раздел Контракты.
- `profiles`, `otp_codes`, `customer_addresses` (`profile_id`, `label`, `address`, `entrance/floor/apartment/intercom`, `delivery_lat/lng`, `is_default`).
- `bonus_settings`, `bonus_transactions`.
- `staff`, `shift_logs`, `courier_locations`.
- `cash_sessions`, `cash_transactions`.
- `pbx_calls` (ОАТС), `incoming_calls` (legacy MoldCell).
- Склад: `ingredient_categories`, `ingredients`, `ingredient_stock`, `stock_ledger`, `semi_finished`, `semi_finished_items`, `product_recipes`, `product_recipe_meta`, `suppliers`, `supply_orders` (`annulled_at`), `supply_order_items`, `stock_writeoffs`, `stock_writeoff_items`, `stock_audits`, `stock_audit_items`.

### Типы

`src/types/database.ts` — `OrderStatus`, `Order`, `OrderItem`, `OrderItemTopping` (`toppings` JSONB), `MenuItem`, `MenuItemVariant`, `MenuItemToppingGroup` (`free_count`), `CashSession`, …

`src/types/cart.ts` — `CartItem`, `CartTopping` (`quantity`, `topping_group_id`), `toppingGroupFreeCounts`, `toppingGroupLabels`.

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
| `POST /api/admin/bonus/adjust` | Корректировка `bonus_transactions`; `staff_id` из тела |
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
- `admin/cash-sessions.ts` — `listCashSessions`, `getCashSessionDetail`, `listStaffForFilter`.
- `inventory/ingredient-categories.ts` — CRUD категорий (service role).
- `(admin)/admin/discount-rules/actions.ts` — `saveRule`, `deleteRule`, `toggleRuleActive` (service role).
- `(admin)/admin/menu/actions.ts` — CRUD позиций; `getMenuItemToppingGroups`, `setMenuItemToppingGroups` (`MenuItemToppingGroupAttachment`).
- `(admin)/admin/toppings/actions.ts` — `save_topping_with_recipes` (RPC).
- Inventory: `supplies/actions.ts` (`createSupplyOrder`, `annulSupplyOrder`), `writeoffs/actions.ts` (`createWriteoff`, service role), `audits/actions.ts` (`createAudit`), `audits/[id]/actions.ts` (`updateAuditItem`, `confirmAudit`, service role).
- `staff/staff-actions.ts`.

### POS (`src/lib/actions/pos/`)

- `auth.ts` — `verifyPin`, `logout` (только cookie), `getCurrentStaff`, `hasOpenShift`, `verifyCurrentStaffPin`.
- `shifts.ts` — `ensureActiveShift`, `closeShift` (закрытие `shift_logs`; не вызывается из `logout`).
- `cash-session.ts` — `openCashSession`, `getCashSession` (`payment_breakdown`, `manual_breakdown`, `recent_manual_transactions`), `getExpectedInDrawerBani`, `getActiveOrdersCountForShift`, `createCashTransaction`, `closeCashSession`, **`payOrder`** (см. инварианты в разделе POS / Касса).
- `create-draft-order.ts` — `createDraftOrderPos`.
- `update-order-brand-pos`, `update-order-details-pos`, `update-order-items`, `updateOrderDeliveryModePos`.
- `send-pos-draft-to-kitchen.ts` — `draft`/`new`/`confirmed` → `cooking`, `cooking_started_at`, пересчёт `total`/`bonuses_redeemed`, `redeemBonus`.
- `accept-order-pos`, `reject-order-pos` — для `new` + `source='website'`.
- `cancel-order-pos`, `delete-draft-order-pos`.
- `assign-courier-pos.ts` — `assignCourierPos`, `changeCourierPos`. После — `sendCourierAssignmentTelegram`.
- `courier-telegram-message.ts` — `sendCourierAssignmentTelegram`, `editPreviousCourierAssignmentTelegram`, `refreshCourierOrderTelegramMessage`.
- `fetch-orders.ts` — `ORDERS_POS_SELECT`, `fetchPosOrders`, `fetchCompletedPosOrders`, `mergeOrdersPreserveBrandSlug`.
- `fetch-kds-orders.ts` — `fetchKdsCookingOrdersPos`, `fetchKdsOrderByIdPos`.
- `update-order-status-kds.ts` — `cooking → ready`.
- `customers-pos-actions.ts` — `posLookupCustomer` (с `bonus_settings`), `posSaveCustomer`, `posSaveCustomerAddress`.
- `check-delivery-zone-pos.ts` — `checkDeliveryZoneByAddress` (возвращает `resolvedParams` при `in_zone`), `getZonesByBrandSlug` (+ `isZoneAvailableNow`, `attachResolvedZoneParams`).
- `create-order-pos.ts`.

### Полезные lib (не actions)

- `lib/bonus.ts` — лояльность.
- `lib/customers.ts` — `getCustomerByPhone`, `saveCustomer`, `saveCustomerAddress`, `setDefaultAddress`, `getDefaultAddress`. Service role.
- `lib/delivery-zone-schedule.ts` — `getActiveSchedule`, `isZoneAvailableNow`, `resolveZoneParams`, `attachResolvedZoneParams`.
- `lib/actions/admin/delivery-zone-schedules.ts` — CRUD слотов расписания зоны.
- `lib/discount-engine.ts` — `evaluateDiscounts`, `isRuleScheduleActive` (pure, без Supabase).
- `lib/order-recipe-stock-deduction.ts` — `computeIngredientTotalsForOrder`.
- `lib/inventory-units.ts`.
- `lib/recipe-editor-qty.ts`, `lib/recipe-composition-row-updates.ts`, `lib/recipe-composition-waste.ts`, `lib/product-recipe-ingredient-qty.ts`.
- `lib/topping-pricing.ts` — `calcToppingGroupCharge`, `calcToppingChargesById`, `getFreeUnitsRemaining`, `formatStorefrontToppingGroupHeader`.
- `lib/topping-max-selection.ts`, `lib/cart-toppings.ts`, `lib/cart-helpers.ts` (`getCartItemToppingDisplayGroups`, `getCartItemSizeLabel`).
- `lib/data/storefront-item-toppings.ts` — `fetchStorefrontMenuItemToppingGroups` (`free_count` с `menu_item_topping_groups`).
- `lib/order-item-size-display.ts`.
- `lib/storefront-delivery-display.ts`, `lib/storefront-pickup-location.ts`, `lib/storefront-account-path.ts`.
- `lib/brand-phone.ts` — `getBrandPhone(slug)`.
- `lib/seo/brand-seo.ts`, `lib/seo/menu-item-image-alt.ts`.
- `lib/pbx/diversion-brand-slug.ts`.
- `lib/pos/alert-sound.ts`, `kds-wakeup.ts`, `scheduled-slots.ts`, `split-composite-delivery-address.ts`, `pos-brand-slug-cookie.ts`, `menu-item-modal-row.ts`, `use-incoming-call.ts`.
- `hooks/use-store-open.ts`, `lib/store-hours.ts` — часы витрины по `BrandConfig` (Chisinau).
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

## Dev notes

- `tsconfig.json`: `"baseUrl": "."` для алиаса `@/*`.
- Turbopack после HMR падает с ошибками типа `Tooltip must be used within TooltipProvider`, `module factory is not available` (часто после правок `CourierMapModal` / динамических импортов) — `npm run dev:clean`.
- 404 на chunks/CSS или `Cannot find module './NNN.js'` — `npm run dev:clean`.
- Не запускать два `next dev` параллельно (второй уйдёт на :3001).
- `/etc/hosts` для локальных доменов: `127.0.0.1 losos.md www.losos.md thespot.md www.thespot.md`.
- Тест с телефона в одной Wi-Fi: `npm run dev -- -H 192.168.50.137`, открыть `http://192.168.50.137:3000/`.
- При проблемах с Turbopack: `npm run dev:webpack`.

## TODO

- Свести один путь `delivery → done`: либо только `payOrder` из `OrderDetail`, либо убрать быстрый «Выдан» с `OrderCard`.
- Выровнять localStorage keys корзины/доставки с `BrandConfig.cartKey` / `deliveryKey`.
- Guard checkout по сессии (если потребуется).
- POS: поддержка quantity / `free_count` топпингов (сейчас плоский toggle через `nextSelectedByGroupWithCap`).
- Подключить `night_delivery_price_bani` / `active_from` / `active_to` зоны в `resolveZoneParams` (сейчас только слоты + базовые колонки; колонки в БД — миграция `*_delivery_zones_night_and_window.sql`, применить на remote Supabase).
- Доработать gallery и lunch sets в админке.
- Перегенерировать `src/lib/supabase/types.ts` через `supabase gen types`.
- Подключить списание ингредиентов в `payOrder` через `computeIngredientTotalsForOrder`.
- UI для детали `/admin/finance/cash-sessions/[id]` (сейчас scaffold).
- Voiding кассовых транзакций в админке.
- Подпись «Позвонить …» в `storefront.ts` под бренд (или оставить динамику в `aria-label` через `getBrandCallLabel`).
