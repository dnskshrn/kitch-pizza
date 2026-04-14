# Kitch! Food Delivery — Project Documentation

## Overview

Food delivery website for **Kitch! Pizza** (Chișinău / Botanica area, Moldova).

- **Stack:** Next.js 14 (App Router), TypeScript, **Tailwind CSS v4** (PostCSS), Supabase (PostgreSQL + Auth + Storage).
- **Public site** (`(client)`): custom layout and components (no shadcn in the storefront shell), **Inter Tight** (Google Fonts, weights 400 / 500 / 700 / 900 + italic for phone typography). Logo: **`public/kitch-pizza-logo.svg`**.
- **Brand tokens (storefront):** `src/lib/client-brand.ts` — accent text/icons **`#5F7600`**, accent button backgrounds **`#ECFFA1`** (e.g. «Акции»), cart pill background **`#ccff00`**. (Legacy docs referred to `#8DC63F`; current UI uses the palette above; **dots** on the mobile promotions slider use **`#8DC63F`** for the active state.)
- **Admin** (`/admin/*`): shadcn/ui, protected by Supabase Auth + middleware. Sidebar header shows **`/kitch-pizza-logo.svg`** (link to `/admin/categories`) instead of the text «Admin Panel». В навигации **первым** пунктом идёт **`/admin/orders`** («Заказы»), далее категории, меню и т.д.
- **Languages:** RU (primary) / RO — UI switcher on the client; `localStorage` key `lang`.
- **Money:** Moldovan Leu (MDL). Prices in DB as **integer bani** (×100 vs lei). Admin inputs lei → save ×100.
- **Корзина (витрина):** Zustand + **`localStorage`** ключ **`kitch-cart`** (состав позиций, `savedAt`, срок 7 дней); промокоды (валидация на сервере, без persist промо); **итог** в футере корзины уже включает доставку из **`delivery-store`**, но **отдельная строка «Доставка»** в UI корзины пока **заглушка** (`-- лей`). На странице **`/checkout`** в боковой сводке строка доставки показывает **фактическую сумму / «Бесплатно»** (или `--`, если нет зоны при доставке).
- **Адрес / доставка (витрина):** Zustand + **`localStorage`** ключ **`kitch-delivery`** (partialize: `mode`, `resolvedAddress`, `lat`, `lng`); **`setResolved`** также пишет черновик **`address`** в инпут (строка «улица + дом»). Модалка (**`DeliveryRoot`**): **десктоп** — split **~960×540**: слева панель формы (~450px), справа **Leaflet** + **Carto** (тайлы из **`src/lib/leaflet-storefront-tiles.ts`**, тот же стиль, что на карте успеха); **мобилка (`< md`)** — **vaul** drawer **92dvh**: **две половины по вертикали** — сверху карта, снизу белая панель формы (без blur); поверх карты — «островок» **Доставка / Самовывоз** (`delivery-mode-island.tsx`, вариант `floating` + glass) и кнопка закрытия; в форме на мобилке заголовок «Адрес доставки» скрыт (есть `Drawer.Title` для a11y). Вне зоны — **`ring-inset`** оранжевым (без клиппинга тени у скролла). Кнопка геолокации по высоте выровнена с полем адреса. Блок условий зоны (время, цена доставки, мин. заказ, бесплатно от) — **ряд иконок + текст** под всеми полями (подъезд…комментарий), без серой подложки. На контейнере карты **`stopPropagation`** touch/pointer — чтобы жесты карты не закрывали sheet. Выбор точки: **кастомный пин** (**`public/Address_Pin_Geo.svg`**) по центру карты — при **`moveend`** reverse geocode центра, зона **`findZoneForPoint`**; **`zones`** на карту передаётся как массив (`?? []`, защита от `undefined`); debounce **forward geocode** ~**800ms** и **«Найти меня»**. Строка адреса: **`nominatim-format-street.ts`** + Nominatim **`addressdetails=1`**. Геокодинг: server actions **`check-delivery-zone.ts`**. Пересчёт зоны после гидратации — только из **`DeliveryRoot`**, **не** из `persist.onRehydrateStorage`.

---

## Tech Stack

| Area | Details |
|------|---------|
| Framework | Next.js 14 App Router, React 18 |
| Styling | Tailwind **v4** (`@import "tailwindcss"`), `@tailwindcss/postcss`, `@source` in `globals.css` for reliable class scanning |
| Config | `tailwind.config.ts` — `content` includes `./src/app/**`, `./src/components/**` |
| UI — admin | shadcn/ui (Radix), `components/ui/*` — в т.ч. **Calendar**, **Popover**, **DatetimePicker** (`react-day-picker`, `date-fns`) для дат в промокодах и фильтров заказов; **Sonner** (`sonner.tsx`) — тосты в админке (смена статуса заказа и др.) |
| UI — storefront | `components/client/*` — TopNav, MainHeader, **MenuCategoryBar**, **MenuSection** / **MenuItemCard** / **ItemBadge**, **product-modal/**, **cart/**, **delivery-modal/** (`DeliveryRoot`, `DeliveryModal`, `DeliverySheet`, `DeliveryContent`; **`DeliveryMap`** только через **dynamic(..., { ssr: false })** в Modal/Sheet — **не** реэкспортировать из `delivery-modal/index.ts`, иначе SSR ломается из‑за `leaflet`), **`checkout/`** — **`order-summary.tsx`**, **`checkout-progress-steps.tsx`**, **`checkout-success-map.tsx`** (Leaflet, dynamic `ssr: false`), PromotionsSlider, `ClientContainer`; **`ClientChrome`** скрывает шапку/меню на **`/checkout*`**; checkout — `app/(client)/checkout/checkout-view.tsx` (shadcn **Select** для слотов времени); lucide icons |
| Dev bundler | По умолчанию **`npm run dev`** → **`next dev --turbo`**; **`dev:webpack`** — классический Webpack; в **`next.config.mjs`** для Webpack в dev **`cache: false`** — меньше рассинхрона чанков (`404` / `Cannot find module './NNN.js'`). |
| Maps (client) | **leaflet**, **leaflet-draw** (админ: рисование полигонов зон); CSS импорты только в client-бандле / dynamic-компонентах |
| Icons | lucide-react (admin + client where needed) |
| Data | Supabase JS + `@supabase/ssr` (server client, browser client); серверные выборки/записи с обходом RLS — **`SUPABASE_SERVICE_ROLE_KEY`** (`src/lib/supabase/service-role.ts`): промокоды, зоны доставки, **создание заказа** (`create-order.ts`), **список заказов и смена статуса** (`get-orders.ts`, `update-order-status.ts`) |
| State | **Zustand** — `cart-store`, **`product-modal-store`** (`open`, **`openForEdit`**, `returnToCart`), **`delivery-store`**, **`delivery-modal-store`** |
| Mobile sheet | **vaul** — модалка товара, корзина, **модалка адреса доставки** на `< md` |
| Deploy | Vercel (typical) |

---

## Repository layout (src)

```
src/
├── app/
│   ├── (client)/
│   │   ├── layout.tsx            # TopNav, MainHeader, MenuCategoryBar, ProductModalRoot, DeliveryRoot, CartRoot (без импорта globals.css — только root layout)
│   │   ├── page.tsx              # Home: PromotionsSlider + MenuSection
│   │   └── checkout/
│   │       ├── page.tsx          # CheckoutView
│   │       ├── checkout-view.tsx # оформление заказа (client), submit → createOrder
│   │       └── success/page.tsx  # успех + Suspense + CheckoutSuccessView
│   ├── (admin)/admin/
│   │   ├── categories/, menu/, toppings/, promotions/
│   │   ├── orders/               # список заказов: page (RSC) + _components/orders-client (filters, table, pagination)
│   │   ├── promo-codes/          # CRUD promo_codes
│   │   ├── delivery-zones/       # CRUD delivery_zones + admin map (Leaflet.draw)
│   │   ├── login/
│   │   └── …
│   ├── api/upload/route.ts
│   ├── globals.css               # единственный импорт глобальных стилей — в app/layout.tsx (дубли в nested layouts ломают HMR/CSS chunks в dev)
│   └── layout.tsx
├── components/client/
│   ├── client-chrome.tsx         # оболочка витрины: на /checkout* без TopNav/MainHeader/MenuCategoryBar
│   ├── checkout/                 # order-summary, checkout-progress-steps, checkout-success-map, checkout-success-view
│   ├── …                         # top-nav, main-header, menu-*, product-modal/*, cart/*, delivery-modal/* (в т.ч. delivery-mode-island.tsx), …
├── components/admin/             # AdminShell, AdminSidebar (+ Toaster из sonner в оболочке админки)
├── components/ui/                # shadcn: button, dialog, calendar, popover, datetime-picker, sonner, …
├── hooks/
├── lib/
│   ├── actions/                  # validate-promo-code.ts, check-delivery-zone.ts, create-order.ts, get-orders.ts, update-order-status.ts ('use server')
│   ├── admin/
│   │   └── orders-url.ts         # парсинг query для /admin/orders, границы дат (UTC), ORDERS_PAGE_SIZE = 50
│   ├── leaflet-storefront-tiles.ts  # общие URL тайлов Carto для DeliveryMap и карты успеха
│   ├── client-brand.ts
│   ├── data/                     # storefront-* fetchers
│   ├── discount.ts               # calcCompareAt, calcPromoDiscount
│   ├── geo.ts                    # isPointInPolygon, findZoneForPoint
│   ├── nominatim-format-street.ts  # краткая строка адреса из полей Nominatim (улица + дом)
│   ├── cart-helpers.ts
│   ├── store/
│   │   ├── cart-store.ts
│   │   ├── product-modal-store.ts
│   │   ├── delivery-store.ts
│   │   └── delivery-modal-store.ts
│   ├── supabase/                 # client.ts, server.ts, service-role.ts
│   └── utils.ts
├── types/database.ts
├── types/cart.ts
└── middleware.ts
public/
├── kitch-pizza-logo.svg
├── Address_Pin_Geo.svg   # пин центра карты в модалке доставки
└── Vector.svg            # маскот на странице успеха чекаута
supabase/migrations/              # SQL; apply via Supabase SQL or MCP
```

---

## Client site (storefront)

| Piece | Description |
|-------|-------------|
| **TopNav** | **Desktop (`md+`):** secondary links, «Акции» pill (`#ECFFA1` / `#5F7600`), schedule **11:00 – 23:00**, RU/RO toggle, 12px row. **`hidden md:block` on mobile** — links / lang in the mobile full-screen menu (MainHeader). |
| **MainHeader** | Logo → `/`, полоса доставки (**Ботаника**, ETA **~N мин** из выбранной зоны или **~42 мин** по умолчанию), кнопка адреса (**`resolvedAddress`** / самовывоз / «Укажите адрес») → открывает **`useDeliveryModalStore.open()`**; телефон **079 700 290**. **Mobile:** burger, logo, phone; burger — full-screen nav. |
| **MenuCategoryBar** | Sticky bar, stuck-state blur + тень; компактный логотип при stuck; корзина `#ccff00`, `openCart()`. |
| **Home menu** | `MenuSection` + `MenuItemCard`; цены, `calcCompareAt` при скидке; клик → product modal. |
| **Product modal** | Desktop ~960×620 (double rAF), **z-[60]/z-[70]** над корзиной; mobile vaul **z-[60]/z-[70]**. «В корзину» → `addItem`; при редактировании позиции из корзины — `removeItem` старой строки + `addItem`. Редактирование: **`openForEdit`** с **`returnToCart: true`** — на **desktop** корзина (`z-40`/`z-50`) остаётся открытой под модалкой; на **mobile** корзина закрывается перед открытием модалки, после «В корзину» **`openCart()`** с задержкой **50ms**. |
| **Cart** | `CartPanel` / `CartSheet` (**z-40** overlay, **z-50** панель); промокод (**`validatePromoCode`**), скидка (`#5F7600`); итог = товары − промо + **доставка** (`delivery-store.getDeliveryFeeBani(subtotal)`); строка «Доставка» в UI корзины пока **-- лей** (заглушка), хотя сумма внизу уже с доставкой. Кнопка **«К оформлению»** → **`/checkout`**. |
| **Checkout** | **`/checkout`** — `CheckoutView`: без глобальной шапки/меню (см. **`ClientChrome`**); пустая корзина после гидратации → редирект на **`/`**. Контакты (имя, телефон ×2), адрес из **`delivery-store`** / самовывоз; под адресом строка **Подъезд / Этаж / Квартира / Домофон** из стора (как в модалке), через запятую, пустые → **`-`**, цвет текста **`#242424`**. Карточка адреса: **нет адреса** — фон **`#f2f2f2`**; **в зоне** — **`#ECFFA1`**; **вне зоны** (`outOfZone`) — **`#FFE1D4`**. Время **КМС** / **слоты 30 мин**, промокод, комментарий; блок **«Метод оплаты»** (нал / карта, сдача с купюры в леях → в БД в банях). Вертикальный ритм формы **~`gap-5`**. **Сводка заказа** — общий компонент **`OrderSummary`** (`components/client/checkout/order-summary.tsx`): позиции с **мини-фото** (`image_url`, `object-contain`, без серой подложки), степпер вынесен в **`CheckoutProgressSteps`** (шаг 2 активен). **Отправка:** server action **`createOrder`** (`src/lib/actions/create-order.ts`) → вставка в **`orders`** + **`order_items`** (service role); при успехе **`/checkout/success?name=…&order=…`** (`order` = `order_number`); при ошибке — красный текст под CTA; на кнопках — **loading** (спиннер). **Мобилка:** sticky CTA; футер **`#f2f2f2`**. |
| **Checkout success** | **`/checkout/success`** — `CheckoutSuccessView` (client + **`Suspense`** из‑за `useSearchParams`): шапка как на чекауте, степпер **шаг 3** активен; лайм-баннер (**`#CCFF00`**) + текст + телефон; маскот **`Vector.svg`** (может визуально выходить за скругление); **Leaflet** карта (**`CheckoutSuccessMap`**, dynamic `ssr: false`) — те же Carto-тайлы, что в модалке; маркер по **`lat`/`lng`** из **`delivery-store`** (самовывоз → ресторан); снова **`OrderSummary`** без кнопки оформления; sticky **«Вернуться в меню»** → **`/`**. Корзина после успеха **не очищается** по ТЗ. Query **`order`** — номер заказа для отображения (при необходимости). |
| **Delivery modal** | **`DeliveryRoot`**: зоны (`getActiveDeliveryZones`). Переключатель режима: **`DeliveryModeIsland`** — на desktop и в нижней панели вариант `panel` (на всю ширину колонки); на mobile над картой — `floating`. Самовывоз — bd. Dacia 27, карта на ресторан **[47.0167, 28.8414]**. **Доставка:** desktop — split; mobile — **верх/низ 50/50**, карта / белая форма; предупреждение вне зоны; поля подъезд…комментарий и блок метрик зоны только **в зоне**. Пин **`Address_Pin_Geo.svg`** по центру, debounce адреса **800ms**, **«Найти меня»**. Закрытие: desktop — X на карте; mobile — X на карте + drawer. |
| **PromotionsSlider** | RU/RO images, 4:3, `use-window-width`. |
| **Layout shell** | `ClientContainer`, max-width 1280px. |

**localStorage keys (client):**

- `lang` — `"RU"` \| `"RO"`
- `kitch-cart` — корзина: `items` + `savedAt` (TTL **7 дней**).
- `kitch-delivery` — доставка (persist): `mode`, `resolvedAddress`, `lat`, `lng`; черновик `address` в памяти, не в partialize.

*(Старый ключ `delivery_address` в текущей логике шапки не используется — источник отображения адреса: `delivery-store`.)*

---

## Admin panel

- **Auth:** Supabase email/password.
- **Middleware:** `/admin/*` (кроме `/admin/login`) → login; залогиненный на `/admin/login` → `/admin/categories`.

### Routes & status

| Route | Description | Status |
|-------|-------------|--------|
| `/admin/login` | Login | Done |
| `/admin/categories` | Categories CRUD | Done |
| `/admin/menu` | Menu items CRUD (+ размеры, веса, скидка %, тег, топпинги) | Done |
| `/admin/toppings` | Groups + toppings + фото | Done |
| `/admin/promotions` | Promotions RU/RO images | Done |
| `/admin/promo-codes` | Промокоды (таблица `promo_codes`) | Done |
| `/admin/delivery-zones` | Зоны доставки: полигон JSONB, цены/минимумы/время, карта Leaflet.draw | Done |
| `/admin/lunch-sets` | Lunch set builder | Planned |
| `/admin/orders` | Заказы: таблица с фильтрами в **URL** (`status`, `date_from`/`date_to`, `time_from`/`time_to`, `search`, `page`), выборка **server-side** через **`getOrders`** (service role), пагинация **50** заказов на страницу; смена статуса **`updateOrderStatus`** | Done |
| `/admin/gallery` | Gallery | Planned |

Sidebar: **«Заказы»** — первый пункт меню; **«Галерея»** — заглушка до реализации.

### Menu item ↔ toppings

- **`menu_item_topping_groups`**: M2M `menu_items` ↔ `topping_groups`; в админке — `getMenuItemToppingGroups` / `setMenuItemToppingGroups`.

---

## Database schema

### menu_categories, menu_items, topping_groups, toppings, menu_item_topping_groups, promotions

Без изменений по смыслу (см. предыдущие версии документа): категории, позиции с весами и `size_*_label`, скидка `%` и тег, топпинги с фото, промо-баннеры RU/RO.

### promo_codes

| Column | Notes |
|--------|--------|
| id | UUID PK |
| code | TEXT UNIQUE, в приложении — uppercase |
| discount_type | `percent` \| `fixed` |
| discount_value | INTEGER (проценты или бани для fixed) |
| min_order_bani, max_uses, uses_count, valid_from, valid_until, is_active, description | как в миграции |
| created_at | TIMESTAMPTZ |

CHECK: тип скидки, `discount_value > 0`, для `percent` — ≤ 100.

### delivery_zones

| Column | Notes |
|--------|--------|
| id | UUID PK |
| name | TEXT |
| polygon | JSONB — массив **`[lat, lng]`** |
| delivery_price_bani, min_order_bani | INTEGER |
| free_delivery_from_bani | INTEGER nullable |
| delivery_time_min | INTEGER (минуты) |
| is_active, sort_order | |
| created_at | TIMESTAMPTZ |

### orders

| Column | Notes |
|--------|-------|
| id | UUID PK |
| order_number | INTEGER UNIQUE (sequence) |
| user_name | TEXT nullable |
| user_phone | TEXT |
| status | `new` \| `in_progress` \| `delivering` \| `done` \| `cancelled` (CHECK) |
| delivery_mode | `delivery` \| `pickup` |
| delivery_address | TEXT (строка для кухни/курьера) |
| payment_method | `cash` \| `card` |
| change_from | INTEGER nullable, бани (сдача с купюры) |
| total | INTEGER бани |
| delivery_fee | INTEGER бани, default 0 |
| discount | INTEGER бани, default 0 |
| promo_code | TEXT nullable |
| scheduled_time | TEXT nullable: `asap` или слот `HH:mm` |
| comment, tg_message_id | TEXT nullable |
| created_at, updated_at | TIMESTAMPTZ |

Индексы: `status`, `created_at DESC`, `user_phone` (см. миграции в `supabase/migrations/`).

### order_items

| Column | Notes |
|--------|-------|
| id | UUID PK |
| order_id | FK → orders |
| menu_item_id, lunch_set_id | UUID nullable |
| item_name | TEXT |
| size | `s` \| `l` nullable (CHECK) |
| quantity | INTEGER |
| toppings | JSONB `[{ name, price }]` (price в банях) |
| price | INTEGER бани (сумма строки позиции) |

### Other tables

`lunch_sets`, `gallery`, … — см. админку / будущие фичи.

---

## TypeScript types

`src/types/database.ts`:

- `Category`, `MenuItem`, `ToppingGroup`, `Topping`, `MenuItemToppingGroup`
- `CategoryWithItems`, `Promotion`, `StorefrontPromotion`
- **`PromoCode`**, **`PromoCodeValidationResult`** / ошибки валидации
- **`DeliveryZone`**, **`DeliveryZoneCheckResult`**
- **`OrderStatus`**, **`PaymentMethod`**, **`DeliveryMode`** (для `orders`; то же union, что режим в `delivery-store`, отдельный экспорт в types)
- **`Order`**, **`OrderItem`**, **`OrderWithItems`**

`src/types/cart.ts`: **`CartItem`**, **`CartSelectedSize`**.

---

## Bilingual strategy

- DB: пары `*_ru` / `*_ro` где нужно; промо — отдельные картинки RU/RO.
- Client: `lang` в `localStorage`; витрина и модалки синхронизируют подписи.

---

## Price convention

- INTEGER bani; отображение ÷ 100.
- Админ: lei → `Math.round(lei * 100)`.
- Скидка на карточке меню: `calcCompareAt`; **промокод корзины:** `calcPromoDiscount` в `discount.ts`.

---

## Styling notes

- Tailwind v4, `@source` в `globals.css`.
- Витрина: без лишних теней на маркетинговых карточках; stuck category bar — лёгкая тень.
- Фото товаров/топпингов/промо: без серых подложек под изображение; плейсхолдер — обводка/текст. В сводке заказа на чекауте/успехе — миниатюры **`object-contain`** (прозрачный PNG без «серой подкладки»).
- Утилиты: `client-container`, `client-menu-grid`, `client-menu-card`.

---

## API routes

| Route | Purpose |
|-------|---------|
| **`POST /api/upload`** | Session → Storage **`menu-images`**, `{ url }`. |

Геокодинг, валидация промокодов, **создание заказа**, **загрузка заказов в админке**, **обновление статуса заказа** — **Server Actions** в `src/lib/actions/` (не отдельные REST-роуты для этих операций).

---

## External services (client-related)

- **Nominatim** (OpenStreetMap): поиск и reverse geocode; **`addressdetails=1`**; заголовок **`User-Agent: KitchPizza/1.0`**; поиск — `countrycodes=md`. Отображаемая строка адреса нормализуется через **`formatStreetLineFromNominatim`** (`src/lib/nominatim-format-street.ts`). Debounce ввода в модалке — **~800ms**; при совпадении текста с `resolvedAddress` повторный forward geocode не запускается.

---

## Planned features (summary)

- **Client:** уведомление заказа в **Telegram** (`tg_message_id`); в корзине — показать строку доставки вместо заглушки `-- лей`; галерея на витрине; scroll-spy для **MenuCategoryBar**; апселл «Соусы / Напитки» из меню.
- **Admin:** lunch sets, gallery UI.
- **Auth customers:** SMS / phone (future).

### Implemented recently (high level)

- **Заказы (витрина):** сохранение с чекаута через **`createOrder`** → таблицы **`orders`** / **`order_items`** (service role); редирект на успех с **`order`** = номер заказа.
- **Заказы (админка):** **`/admin/orders`** — фильтры в query, **`getOrders`** + **`parseOrdersSearchParams`** / **`ordersCreatedAtBounds`**, таблица и диалог деталей, **`updateOrderStatus`** + Sonner; деньги в UI: **bani ÷ 100** и строка «… лей».
- **Checkout / success:** общие **`OrderSummary`**, **`CheckoutProgressSteps`**; страница успеха с баннером, **`Vector.svg`**, Leaflet-картой (тайлы **`leaflet-storefront-tiles.ts`**, координаты из **`delivery-store`**); обработка ошибок и loading на submit.
- **Карты (витрина):** общие тайлы Carto в **`leaflet-storefront-tiles.ts`**; иконка пина **`Address_Pin_Geo.svg`**; защита от `zones === undefined` на **`DeliveryMap`**.
- **Dev:** по умолчанию **`next dev --turbo`**; **`dev:webpack`** для отката; **`dev:clean`** при битом `.next`; **`next.config`**: отключение Webpack cache в dev.
- **delivery-modal:** **`DeliveryMap`** не реэкспортируется из **`index.ts`** (SSR + `leaflet`).
- Корзина: промокоды (server validation), доставка в итоге через **`delivery-store`**; строка «Доставка» в UI корзины — по-прежнему заглушка `-- лей`. Редактирование позиции из корзины: **`product-modal-store.openForEdit`** / **`returnToCart`**.
- Модалка адреса: split / drawer; **`ring-inset`** вне зоны; без server actions в **`onRehydrateStorage`** у delivery persist.
- Админ: **промокоды**, **зоны доставки** (Leaflet.draw), **заказы** (список, статусы).
- **`service-role`** Supabase: промо, зоны, **создание заказа**, **чтение/обновление заказов в админке**.
- Глобальные стили: **`globals.css`** только в **`app/layout.tsx`**.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server-only when needed:
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
# Future:
SMS_MD_API_KEY=
```

---

## Supabase Storage

- Bucket **`menu-images`** — публичные URL для меню, топпингов, промо.

---

## npm scripts

| Script | Command |
|--------|---------|
| **`dev`** | `next dev --turbo` (Turbopack по умолчанию) |
| **`dev:webpack`** | `next dev` (Webpack, без Turbo) |
| **`dev:clean`** | `rm -rf .next && next dev --turbo` |

---

## Dev tips

- Поломка стилей / модулей в `.next` (404 на `/_next/static/css/...`, `Cannot find module './NNN.js'`) → **`npm run dev:clean`** или `rm -rf .next` и перезапуск dev; **не держать два** `next dev` на одном проекте (второй часто уходит на **3001** — рассинхрон с браузером на **3000**).
- Не дублировать **`import` globals.css** в `(client)/layout` и root — один импорт в **`app/layout.tsx`**.
- **`next.config.mjs`:** в режиме Webpack dev отключён **filesystem cache** (`webpack` → `config.cache = false` при `dev`) — стабильнее HMR; при **`next dev --turbo`** этот хук не используется.
