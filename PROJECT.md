# Kitch! Food Delivery — Project Documentation

## Overview

Food delivery website for **Kitch! Pizza** (Chișinău / Botanica area, Moldova), архитектура **multi-brand** (один репозиторий / один деплой — несколько витрин по доменам + общая админка с переключателем бренда).

- **Stack:** Next.js 14 (App Router), TypeScript, **Tailwind CSS v4** (PostCSS), Supabase (PostgreSQL + Auth + Storage).
- **Дизайн-система** (`DESIGN.md`): палитра **5 цветов** — `#ffffff` · `#f2f2f2` · `#242424` · `#808080` · `#ccff00`; шрифты **Inter** (400 / 700) + **Roboto Mono** (400 / 700); все токены в CSS-переменных (`globals.css`). Единственный акцент — лайм `#ccff00` для CTA. Noto Serif и Geist удалены.
- **Public site** (`(client)`): custom layout and components (no shadcn in the storefront shell), **Inter Tight** (Google Fonts, weights 400 / 500 / 700 / 900 + italic for phone typography). Логотип и палитра для витрины задаются в **`src/brands/index.ts`** (`BrandConfig`, `getBrandByHost`); middleware пробрасывает **`x-brand-slug`** по `Host` (см. **`src/middleware.ts`**), `(client)/layout` ставит **`data-brand`** на shell.
- **Brand tokens (storefront):** канонический конфиг — **`src/brands`** (per-brand `colors`, `logo`, ключи `cartKey` / `deliveryKey` и т.д.) + scoped CSS-переменные в **`globals.css`** (`[data-brand="the-spot"]`). **`src/lib/client-brand.ts`** — устаревшие фиксированные константы для части UI; постепенно выравнивается с бренд-конфигом.
- **Admin** (`/admin/*`): shadcn/ui, Supabase Auth + middleware. **Данные привязаны к выбранному бренду:** кука **`admin-brand-slug`**, резолв UUID через **`getAdminBrandId()`** (`src/lib/get-admin-brand-id.ts`); в сайдбаре — **`BrandSwitcher`**, список активных брендов грузится из Supabase через **`getBrands()`** (`src/lib/actions/get-brands.ts`). Шапка сайдбара: логотип текущего бренда из конфига, ссылка на `/admin/categories`. В навигации **первым** пунктом идёт **`/admin/orders`** («Заказы»), далее категории, меню и т.д.
- **Kitch POS** (`/pos/*`): отдельный вход по **PIN** (таблица **`staff`**, сессия **JWT** в httpOnly-куке **`pos-session`**, path `/pos`), смены в **`shift_logs`**; тот же **shadcn** / **`globals.css`**, что и в админке; защита в middleware + layout. Рабочая зона **`/pos`**: **12-колоночная сетка** (`gap-5` / 20px, `p-5` / 20px) на **белом** фоне страницы; **две колонки-панели** (`col-span-3` / `col-span-9`) — **`rounded-xl bg-[#f2f2f2]`** («острова» на белом), внутри — белые карточки заказов, белые блоки меню/корзины в мастере и т.д. Шапка POS — **`PosAppShell`**: серый **`#f2f2f2`** «остров» с **`rounded-2xl`**, часы / таймер смены / выход (кнопка «Выйти» — белая плашка). Создание заказа — **`createOrderPos`** (service role, `source='pos'`, **`operator_id`** из сессии). Подробнее — раздел **«Kitch POS»** ниже.
- **Languages:** RU (primary) / RO — UI switcher on the client; `localStorage` key `lang`.
- **Money:** Moldovan Leu (MDL). Prices in DB as **integer bani** (×100 vs lei). Admin inputs lei → save ×100.
- **Корзина (витрина):** Zustand + **`localStorage`** (сейчас ключ **`kitch-cart`** в `cart-store`; в **`BrandConfig`** заложены `cartKey` / `deliveryKey` per brand — при расширении на несколько витрин ключи можно выровнять с брендом). Промокоды (валидация на сервере, без persist промо); **итог** в футере корзины уже включает доставку из **`delivery-store`**, но **отдельная строка «Доставка»** в UI корзины пока **заглушка** (`-- лей`). На странице **`/checkout`** в боковой сводке строка доставки показывает **фактическую сумму / «Бесплатно»** (или `--`, если нет зоны при доставке).
- **Адрес / доставка (витрина):** Zustand + **`localStorage`** ключ **`kitch-delivery`** (`delivery-store`, partialize: `mode`, `resolvedAddress`, `lat`, `lng`); **`setResolved`** также пишет черновик **`address`** в инпут (строка «улица + дом»). Модалка (**`DeliveryRoot`**): **десктоп** — split **~960×540**: слева панель формы (~450px), справа **Leaflet** + **Carto** (тайлы из **`src/lib/leaflet-storefront-tiles.ts`**, тот же стиль, что на карте успеха); **мобилка (`< md`)** — fullscreen fixed dialog **без `vaul`**, две половины по вертикали: сверху карта, снизу белая панель формы (без blur). Поверх карты — «островок» **Доставка / Самовывоз** (`delivery-mode-island.tsx`, вариант `floating`) слева, кнопка закрытия справа; закрытие на mobile только через **X** / «Выбрать» (без swipe-to-close), чтобы жесты Leaflet свободно двигали карту. Кнопки Leaflet **+ / −** на mobile перенесены вниз слева, «Найти меня» — снизу справа. Вне зоны — **`ring-inset`** оранжевым (без клиппинга тени у скролла). Кнопка геолокации по высоте выровнена с полем адреса. Блок условий зоны (время, цена доставки, мин. заказ, бесплатно от) — **ряд иконок + текст** под всеми полями (подъезд…комментарий), без серой подложки. Выбор точки: **кастомный пин** (**`public/Address_Pin_Geo.svg`**) по центру карты — при **`moveend`** reverse geocode центра, зона **`findZoneForPoint`**; **`zones`** на карту передаётся как массив (`?? []`, защита от `undefined`); debounce **forward geocode** ~**800ms** и **«Найти меня»**. Строка адреса: **`nominatim-format-street.ts`** + Nominatim **`addressdetails=1`**. Геокодинг: server actions **`check-delivery-zone.ts`**. Пересчёт зоны после гидратации — только из **`DeliveryRoot`**, **не** из `persist.onRehydrateStorage`.

---

## Tech Stack

| Area | Details |
|------|---------|
| Framework | Next.js 14 App Router, React 18 |
| Styling | Tailwind **v4** (`@import "tailwindcss"`), `@tailwindcss/postcss`, `@source` in `globals.css`; палитра в **`globals.css`** через CSS-переменные oklch — 5 цветов дизайн-системы: `#ffffff / #f2f2f2 / #242424 / #808080 / #ccff00` (см. `DESIGN.md`) |
| Config | `tailwind.config.ts` — `content` includes `./src/app/**`, `./src/components/**` |
| UI — admin | shadcn/ui (Radix), `components/ui/*` — в т.ч. **Calendar**, **Popover**, **DatetimePicker** (`react-day-picker`, `date-fns`) для дат в промокодах и фильтров заказов; **Sonner** (`sonner.tsx`) — тосты в админке (смена статуса заказа и др.) |
| UI — storefront | `components/client/*` — TopNav, MainHeader, **MenuCategoryBar**, **MenuSection** / **MenuItemCard** / **ItemBadge**, **product-modal/**, **cart/**, **delivery-modal/** (`DeliveryRoot`, `DeliveryModal`, `DeliverySheet`, `DeliveryContent`; **`DeliveryMap`** только через **dynamic(..., { ssr: false })** в Modal/Sheet — **не** реэкспортировать из `delivery-modal/index.ts`, иначе SSR ломается из‑за `leaflet`), **`checkout/`** — **`order-summary.tsx`**, **`checkout-progress-steps.tsx`**, **`checkout-success-map.tsx`** (Leaflet, dynamic `ssr: false`), PromotionsSlider, `ClientContainer`; **`ClientChrome`** скрывает шапку/меню на **`/checkout*`**; checkout — `app/(client)/checkout/checkout-view.tsx` (shadcn **Select** для слотов времени); lucide icons |
| Dev bundler | По умолчанию **`npm run dev`** → **`next dev --turbo`**; **`dev:webpack`** — классический Webpack; в **`next.config.mjs`** для Webpack в dev **`cache: false`** — меньше рассинхрона чанков (`404` / `Cannot find module './NNN.js'`). |
| Maps (client) | **leaflet**, **leaflet-draw** (админ: рисование полигонов зон); CSS импорты только в client-бандле / dynamic-компонентах |
| Icons | lucide-react (admin + client where needed) |
| Data | Supabase JS + `@supabase/ssr` (server client, browser client); серверные выборки/записи с обходом RLS — **`SUPABASE_SERVICE_ROLE_KEY`** (`src/lib/supabase/service-role.ts`): промокоды, зоны доставки, **создание заказа** (`create-order.ts`), **список заказов и смена статуса** (`get-orders.ts`, `update-order-status.ts`), резолв **`brands.id`** (`get-brand-id.ts` / **`get-admin-brand-id.ts`**) |
| Multi-brand | Таблица **`brands`**, колонка **`brand_id`** на контентных таблицах; **`src/brands/index.ts`**, **`get-brand.ts`** (витрина: заголовок **`x-brand-slug`**), **`get-brand-id.ts`** / **`get-admin-brand-id.ts`**; витринные fetchers в **`src/lib/data/*`** и **checkout** фильтруют по `brand_id`; админка — по **`getAdminBrandId()`** |
| POS | **`bcryptjs`** + **`jose`** (JWT сессия кассира); server actions **`src/lib/actions/pos/*`** (**`auth`**, **`shifts`**, **`create-order-pos`**, **`check-delivery-zone-pos`**); кука **`pos-session`**, env **`POS_SESSION_SECRET`** (≥ 32 символа). UI заказов на кассе — прямые запросы **`createBrowserClient`** + Realtime; промокод в форме POS вызывает существующий **`validatePromoCode`** (ограничение: привязка к бренду витрины по **`getBrandId()`**, не к выбранному в мастере бренду, пока action не расширен). |
| State | **Zustand** — `cart-store`, **`product-modal-store`** (`open`, **`openForEdit`**, `returnToCart`), **`delivery-store`**, **`delivery-modal-store`** |
| Mobile sheet | **vaul** — модалка товара и корзина; **модалка адреса доставки** на `< md` — custom fullscreen fixed dialog без `vaul` (чтобы не перехватывать жесты Leaflet) |
| Deploy | Vercel (typical) |

---

## Multi-brand (кратко)

| Механизм | Файлы / поведение |
|----------|-------------------|
| Конфиг брендов | `src/brands/index.ts` — `BrandConfig`, `brands[]`, `getBrandByHost`, `getBrandBySlug`; configured slugs: `kitch-pizza`, `losos`, `the-spot`. `getBrandByHost()` нормализует `Host` без порта (`thespot.md:3000` → `thespot.md`). |
| Витрина (host → slug) | `middleware` выставляет **`x-brand-slug`**; **`getBrand()`** / **`getBrandId()`** в RSC / server actions витрины и **`createOrder`**; `(client)/layout.tsx` читает header и ставит `data-brand` на shell. |
| Админка (ручной выбор) | Кука **`admin-brand-slug`**; **`setAdminBrand`** (`src/lib/actions/set-admin-brand.ts`); **`getAdminBrandSlug`**, **`getAdminBrandId`** валидируют активный slug через таблицу `brands`; **`BrandSwitcher`** в сайдбаре получает активные бренды через **`getBrands()`** (`src/lib/actions/get-brands.ts`). |
| Данные | Все SELECT/INSERT/UPDATE по контентным таблицам с **`brand_id`** (админ: `getAdminBrandId`; витрина: `getBrandId`). Дочерние таблицы без `brand_id` (напр. `order_items`, `menu_item_topping_groups`) не фильтруются отдельно |

---

## Kitch POS (кратко)

| Элемент | Описание |
|---------|-----------|
| URL | **`/pos`** — рабочая зона (после входа); **`/pos/login`** — экран PIN |
| Auth | Server actions **`src/lib/actions/pos/auth.ts`**: **`verifyPin`**, **`logout`**, **`getCurrentStaff`**; JWT HS256, срок **12h**; кука **`pos-session`**, `path: '/pos'`, `httpOnly` |
| Смены | **`src/lib/actions/pos/shifts.ts`**: **`ensureActiveShift`**, **`closeShift`**; таблица **`shift_logs`** (`staff_id`, `clock_in`, `clock_out`); при **`logout`** открытая смена закрывается; **`ensureActiveShift`** устойчив к дублям: берёт самую свежую открытую смену через `.limit(1)` вместо `.maybeSingle()` |
| Layout / шапка | **`src/app/pos/layout.tsx`** (RSC): auth, редиректы, **`ensureActiveShift`**; оболочка — клиентский **`PosAppShell`** (`src/components/pos/pos-app-shell.tsx`): белый фон страницы, **`<main>`** `flex min-h-0 flex-1 overflow-hidden`; в шапке — **`pos-clock-widget`** (время после mount), имя, **`pos-shift-timer`**, **`pos-logout-button`**. Отдельный клиентский корень — чтобы хуки не ломались при **Turbopack + RSC**. |
| **`/pos` (страница)** | Клиентская **`src/app/pos/page.tsx`**: **12-колоночный grid** (`grid-cols-12`, `gap-5 p-5`, **`bg-white`**); **`col-span-3`** / **`col-span-9`** — панели **`rounded-xl bg-[#f2f2f2]`**; слева — **`orders-panel`** (заголовок «Заказы» mono + **белая pill** с табами `variant="pos"`, список за 24ч, **`order-card`** — белые карточки с зазором, Realtime INSERT с beep); справа — **`RightPanelState`**: idle / **`order-detail`** / **`order-form`** |
| Деталь заказа | **`src/components/pos/order-detail.tsx`**: полная выборка заказа + позиции + `menu_items(name_ru)`, Realtime UPDATE по `id`, блоки клиент/доставка/состав/служебное, липкий футер с кнопками статусов (как на карточке). Проп **`onEdit`** зарезервирован для родителя |
| Новый заказ | **`src/components/pos/order-form.tsx`**: 3-шаговый мастер. **Шапка** прозрачная (нет `bg`) — серый фон острова проявляется сквозь неё; **grid 1fr / auto / 1fr** (назад+название \| шаги 1→2→3 \| закрыть); кнопка закрытия — белая плашка **`posHeaderCloseButtonClassName`**. **Шаг 1** — выбор бренда. **Шаг 2** — серый остров с двумя белыми `rounded-xl` карточками через `gap-3`: **«Оформление заказа»** (`flex-1`, лейбл 11px uppercase по центру, белая pill с табами категорий на `bg-[#f2f2f2]`, сетка товаров с `rounded-full` фото и кнопкой `+`) + **«Корзина»** (`w-300px`, лейбл «КОРЗИНА N», список позиций с round-фото/счётчиком/ценой, футер подытог + lime CTA «К оформлению →»). **Шаг 3** — двухколоночная схема (форма + «Сводка»): форма разбита на секции-карточки «Тип заказа» / «Контактные данные» / «Метод оплаты» / «Дополнительно»; переключатели типа заказа и оплаты — крупные `ModeButton`; поле адреса с debounce **800 мс** → `checkDeliveryZoneByAddress` → инфо-блок с тарифами зоны + динамический `deliveryFee`. **`PosCartItem`** включает поле **`imageUrl?`** — миниатюры в корзине и сводке. Отправка: **`form.handleSubmit(submitCheckout)`**. После успеха — деталь по **`orderId`**. |
| Данные POS (клиент) | **`src/lib/pos/fetch-orders.ts`** (`fetchPosOrders`, **`fetchPosOrderById`**), типы **`src/types/pos.ts`** (**`PosOrder`**, **`PosCartItem`** + **`imageUrl?`**, статусы, **`source`**) |
| Заказ с кассы (сервер) | **`createOrderPos`** — **`src/lib/actions/pos/create-order-pos.ts`**: **`getBrandIdBySlug`** через service role (не **`getAdminBrandId`**), **`getCurrentStaff()`** → **`operator_id`**, **`source: 'pos'`**, вставка **`orders`** + **`order_items`**, `scheduled_time: 'asap'` |
| Заказы из админки (витрина) | **`createOrderAdmin`** — `src/lib/actions/create-order-admin.ts` (бренд **`getAdminBrandId`**, общая логика с витриной через **`executeCreateOrder`**) |
| Middleware | Для **`/pos/*`** кроме **`/pos/login`** — проверка JWT; иначе редирект на логин; плюс общая логика **`x-brand-slug`** / **`x-pathname`** (для условного layout) |

---

## Repository layout (src)

```
src/
├── app/
│   ├── (client)/
│   │   ├── layout.tsx            # ClientChrome + data-brand из x-brand-slug (без импорта globals.css — только root layout)
│   │   ├── page.tsx              # Home: PromotionsSlider + MenuSection; The Spot mobile: категории после промо + floating cart
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
│   ├── pos/                      # Kitch POS: login; layout (RSC + PosAppShell); page (12-кол.: заказы + правая зона)
│   ├── api/upload/route.ts
│   ├── globals.css               # единственный импорт глобальных стилей — в app/layout.tsx (дубли в nested layouts ломают HMR/CSS chunks в dev)
│   └── layout.tsx
├── components/client/
│   ├── client-chrome.tsx         # оболочка витрины: на /checkout* без TopNav/MainHeader/MenuCategoryBar
│   ├── checkout/                 # order-summary, checkout-progress-steps, checkout-success-map, checkout-success-view
│   ├── …                         # top-nav, main-header, menu-*, product-modal/*, cart/*, delivery-modal/* (в т.ч. delivery-mode-island.tsx), …
├── components/admin/             # AdminShell, AdminSidebar, BrandSwitcher (+ Toaster из sonner в оболочке админки)
├── components/pos/               # pos-app-shell, pos-clock-widget, pos-shift-timer, pos-header-icon-button, pos-logout-button, orders-panel, order-card, order-detail, order-form, pos-product-modal
├── components/ui/                # shadcn: button, dialog, alert, card, calendar, popover, datetime-picker, sonner, …
├── hooks/
├── brands/
│   └── index.ts                  # BrandConfig, brands[], getBrandByHost / getBrandBySlug
├── lib/
│   ├── actions/
│   │   ├── validate-promo-code.ts, check-delivery-zone.ts, create-order.ts, create-order-admin.ts, get-brands.ts
│   │   ├── get-orders.ts, update-order-status.ts ('use server')
│   │   ├── set-admin-brand.ts
│   │   └── pos/                  # auth.ts, shifts.ts, create-order-pos.ts, check-delivery-zone-pos.ts — PIN / JWT / смены / заказ с кассы / зона доставки по адресу
│   ├── admin/
│   │   └── orders-url.ts         # парсинг query для /admin/orders, границы дат (UTC), ORDERS_PAGE_SIZE = 50
│   ├── leaflet-storefront-tiles.ts  # общие URL тайлов Carto для DeliveryMap и карты успеха
│   ├── client-brand.ts           # legacy фиксированные цвета витрины
│   ├── get-brand.ts, get-brand-id.ts
│   ├── get-admin-brand-id.ts
│   ├── pos/
│   │   ├── jwt-secret.ts         # ключ JWT для POS (общий с server actions; читает POS_SESSION_SECRET)
│   │   └── fetch-orders.ts       # клиент: выборка списка/одного заказа для POS (маппинг brands.slug, order_items count)
│   ├── data/                     # storefront-* fetchers (фильтр brand_id + getBrandId)
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
├── types/pos.ts                  # PosOrder, статусы и source для UI кассы
└── middleware.ts                 # x-brand-slug; x-pathname; /admin Supabase session; /pos JWT (кроме /pos/login)
public/
├── kitch-pizza-logo.svg
├── the-spot-logo.svg
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
| **MenuCategoryBar** | Sticky bar, stuck-state blur + тень; компактный логотип при stuck. Клик по категории плавно скроллит к секции `MenuSection` (`id="menu-category-{slug}"`), scroll-spy подсвечивает активную категорию по позиции страницы; на mobile активная кнопка плавно прокручивается в видимую область. **Kitch:** cart pill в sticky bar только `md+`; на mobile — bottom floating cart в той же геометрии, что The Spot, но с lime CTA `#ccff00`. |
| **Home menu** | `MenuSection` + `MenuItemCard`; цены, `calcCompareAt` при скидке; клик → product modal. Секции категорий имеют `scroll-mt` под sticky header/category bar. |
| **The Spot storefront** | Активируется при `data-brand="the-spot"` / slug `the-spot`. **`ClientChrome`** скрывает `TopNav` и глобальный Kitch `MenuCategoryBar`; на главной `page.tsx` категории рендерятся после промо. **Mobile header:** белая pill `63px` с `the-spot-logo.svg`, адресом (`str. Dacia 35` fallback) и burger. **Tablet/Desktop header (`md+`):** отдельная белая rounded-full/pill-плашка на фоне `#f5f2f0`: логотип, адресная pill-кнопка, nav (`Меню` / `Акции` / `Контакты`), RU/RO toggle на `lg+`, телефон на `xl+`, burger на `md/lg`. **Промо:** если баннеров нет — mobile два placeholder-блока `286×126`, на `md+` три белых cards `aspect-[16/7]`; реальные баннеры на The Spot `md+` тоже `16/7`. **Категории:** brand-specific `TheSpotCategoryBar`: mobile горизонтальные pill-чипы, `md+` sticky белая pill-полоса с категориями и оранжевой корзиной; active `#f25130`/white; клик/scroll-spy синхронизированы с `MenuSection`. **Меню:** mobile 2 колонки; `md` — 3 колонки, `xl` — 4 колонки; белые image cards `aspect-square rounded-[12px]`, текст `#242424`, muted `rgb(36 36 36 / 60%)`, price pill `#ffebe7` / `#b7614f`, hover на price pill в `#f25130`/white, формат `MDL`. **Floating cart:** только mobile (`md:hidden`) fixed bottom glass pill, CTA `#f25130`, сумма через `selectCartSubtotal`. |
| **Product modal** | Desktop ~960×620 (double rAF), **z-[60]/z-[70]** над корзиной; mobile vaul **z-[60]/z-[70]**. «В корзину» → `addItem`; при редактировании позиции из корзины — `removeItem` старой строки + `addItem`. Редактирование: **`openForEdit`** с **`returnToCart: true`** — на **desktop** корзина (`z-40`/`z-50`) остаётся открытой под модалкой; на **mobile** корзина закрывается перед открытием модалки, после «В корзину» **`openCart()`** с задержкой **50ms**. Стили подключены к storefront modal primitives (`storefront-modal-*`): Kitch сохраняет lime/gray систему, The Spot получает warm bg `#f5f2f0`, white surfaces, orange CTA/accent. |
| **Cart** | `CartPanel` / `CartSheet` (**z-40** overlay, **z-50** панель); промокод (**`validatePromoCode`**), скидка через brand-aware accent; итог = товары − промо + **доставка** (`delivery-store.getDeliveryFeeBani(subtotal)`); строка «Доставка» в UI корзины пока **-- лей** (заглушка), хотя сумма внизу уже с доставкой. Кнопка **«К оформлению»** → **`/checkout`**. Поверхности/CTA переведены на storefront modal primitives для Kitch/The Spot. |
| **Checkout** | **`/checkout`** — `CheckoutView`: без глобальной шапки/меню (см. **`ClientChrome`**); `page.tsx` получает текущий бренд через **`getBrand()`** и передаёт `brandLogo`/`brandName`/`brandSlug`; логотип в шапке ведёт на `/`, кнопка назад — белая. Пустая корзина после гидратации → редирект на **`/`**. Контакты (имя, телефон ×2), адрес из **`delivery-store`** / самовывоз; под адресом строка **Подъезд / Этаж / Квартира / Домофон** из стора (как в модалке), через запятую, пустые → **`-`**. Карточка адреса — brand-aware (`storefront-checkout-address-*`): Kitch `#f2f2f2` / `#ECFFA1` / `#FFE1D4`; The Spot white / accent-soft. Время: **КМС** или **Указать время**; при scheduled сначала показываются быстрые кнопки ближайших интервалов от текущего времени (`+1:00`, `+1:15`, `+1:30`, `+1:45`, `+2:00`, округление вверх до ближайших 15 мин, не позже 23:00), отдельная кнопка **«Указать время»** открывает кастомный dropdown со слотами 30 мин. Промокод, комментарий, блок **«Метод оплаты»** (нал / карта, сдача с купюры в леях → в БД в банях). The Spot получает белую `storefront-checkout-form-panel`; активные toggles — `storefront-checkout-toggle-active` (Kitch lime, The Spot orange). **Сводка заказа** — общий **`OrderSummary`**; степпер — **`CheckoutProgressSteps`**. **Отправка:** server action **`createOrder`** → `orders` + `order_items`; успех → **`/checkout/success?name=…&order=…`**. **Мобилка:** sticky CTA; футер brand-aware. |
| **Checkout success** | **`/checkout/success`** — `CheckoutSuccessView` (client + **`Suspense`** из‑за `useSearchParams`): получает brand props из `success/page.tsx`; шапка как на чекауте, логотип → `/`, белая кнопка назад, степпер **шаг 3** активен; hero `storefront-checkout-success-hero` (Kitch lime, The Spot accent-soft) + текст + телефон; маскот **`Vector.svg`**; **Leaflet** карта (**`CheckoutSuccessMap`**, dynamic `ssr: false`) — те же Carto-тайлы, что в модалке; маркер по **`lat`/`lng`** из **`delivery-store`** (самовывоз → ресторан); снова **`OrderSummary`** без кнопки оформления; sticky **«Вернуться в меню»** → **`/`**. Корзина после успеха **не очищается** по ТЗ. Query **`order`** — номер заказа для отображения (при необходимости). |
| **Delivery modal** | **`DeliveryRoot`**: зоны (`getActiveDeliveryZones`). Переключатель режима: **`DeliveryModeIsland`** — на desktop и в нижней панели вариант `panel` (на всю ширину колонки); на mobile над картой — `floating`, слева. Самовывоз — bd. Dacia 27, карта на ресторан **[47.0167, 28.8414]**. **Доставка:** desktop — split; mobile — fullscreen fixed dialog без `vaul`, **верх/низ 50/50**, карта / белая форма; предупреждение вне зоны; поля подъезд…комментарий и блок метрик зоны только **в зоне**. Пин **`Address_Pin_Geo.svg`** по центру, debounce адреса **800ms**, **«Найти меня»** снизу справа, Leaflet zoom **bottomleft** на mobile. Закрытие: desktop — X на карте; mobile — X / «Выбрать» (без swipe-to-close). Поверхности/CTA/иконки/полигоны карты используют storefront modal primitives / `--color-accent` для The Spot. |
| **PromotionsSlider** | RU/RO images, default 4:3, `use-window-width`; для The Spot `md+` — cards `16/7`, placeholders при отсутствии баннеров. |
| **Layout shell** | `ClientContainer`, max-width 1280px. |

**localStorage keys (client):**

- `lang` — `"RU"` \| `"RO"`
- `kitch-cart` — корзина: `items` + `savedAt` (TTL **7 дней**).
- `kitch-delivery` — доставка (persist): `mode`, `resolvedAddress`, `lat`, `lng`; черновик `address` в памяти, не в partialize.

*(Старый ключ `delivery_address` в текущей логике шапки не используется — источник отображения адреса: `delivery-store`.)*

---

## Admin panel

- **Auth:** Supabase email/password.
- **Middleware:** для **`/admin/*`** (кроме **`/admin/login`**) — редирект на логин без сессии Supabase; залогиненный на **`/admin/login`** → **`/admin/categories`**. Для **`/pos/*`** (кроме **`/pos/login`**) — проверка JWT **`pos-session`**, иначе → **`/pos/login`**. Для всех страниц в matcher — заголовки **`x-brand-slug`**, **`x-pathname`** (для layout POS и витрины).
- **Multi-brand в админке:** выбор бренда не зависит от домена; данные через **`getAdminBrandId()`**.

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

**Kitch POS** (`/pos/*`, shadcn, отдельно от Supabase Admin Auth):

| Route | Description | Status |
|-------|-------------|--------|
| `/pos/login` | Вход по PIN (карточка + numpad) | Done |
| `/pos` | **12-кол. сетка** (3+9, `gap-5` `p-5`, **фон страницы белый**; колонки **`rounded-xl bg-[#f2f2f2]`**); слева — заказы (Realtime); справа — деталь / мастер (**`createOrderPos`**); UI по **`DESIGN.md`** (островки, pill-табы, карточки) | Done |

Sidebar админки: **«Заказы»** — первый пункт меню; **«Галерея»** — заглушка до реализации.

### Menu item ↔ toppings

- **`menu_item_topping_groups`**: M2M `menu_items` ↔ `topping_groups`; в админке — `getMenuItemToppingGroups` / `setMenuItemToppingGroups`.

---

## Database schema

### brands

| Column | Notes |
|--------|--------|
| id | UUID PK |
| slug | TEXT UNIQUE (напр. `kitch-pizza`) |
| name | Отображаемое имя бренда |

Контентные таблицы (**`menu_categories`**, **`menu_items`**, **`topping_groups`**, **`toppings`**, **`orders`**, **`promo_codes`**, **`delivery_zones`**, **`promotions`**, **`gallery`**, **`lunch_sets`**, …) содержат **`brand_id`** UUID NOT NULL → **`brands(id)`** с индексами; витрина и админка фильтруют запросы по текущему бренду.

### staff (POS)

| Column | Notes |
|--------|--------|
| id | UUID PK |
| name, phone, role | TEXT |
| pin_hash | bcrypt |
| is_active | boolean |
| created_at | TIMESTAMPTZ |

### shift_logs (POS)

| Column | Notes |
|--------|--------|
| id | UUID PK |
| staff_id | FK → staff |
| clock_in, clock_out | TIMESTAMPTZ; **`clock_out`** NULL = открытая смена |

### menu_categories, menu_items, topping_groups, toppings, menu_item_topping_groups, promotions

Категории, позиции с весами и `size_*_label`, скидка `%` и тег, топпинги с фото, промо-баннеры RU/RO; у родительских сущностей — поле **`brand_id`** (см. выше).

### promo_codes

| Column | Notes |
|--------|--------|
| id | UUID PK |
| brand_id | UUID NOT NULL → brands |
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
| brand_id | UUID NOT NULL → brands |
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
| brand_id | UUID NOT NULL → brands |
| order_number | INTEGER UNIQUE (sequence) |
| user_name | TEXT nullable |
| user_phone | TEXT |
| user_birthday | DATE nullable (миграция; день рождения в POS/деталке) |
| operator_id | UUID nullable → кассир (**`staff`**), заполняется при заказе с POS (**`createOrderPos`**) |
| source | `website` \| `pos` (миграция; витрина/админ по умолчанию **website**, касса — **pos**) |
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

`src/types/pos.ts`: типы заказа для UI кассы (**`PosOrder`**, **`PosOrderStatus`**, **`PosOrderSource`**) — в т.ч. **`brand_slug`** и **`item_count`** из join/агрегата на клиенте.

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
- **Дизайн-система** (см. `DESIGN.md`): 5 цветов — `#ffffff / #f2f2f2 / #242424 / #808080 / #ccff00`; шрифты Inter 400/700 + Roboto Mono 400/700. Все токены — CSS-переменные oklch в `:root`. Единственный акцент — лайм `#ccff00` исключительно для CTA-кнопок. Noto Serif и Geist удалены из `layout.tsx`.
- **Brand CSS variables:** `globals.css` задаёт базовые storefront-токены (`--color-accent`, `--color-bg`, `--color-text`, `--color-muted`, `--color-surface`, `--color-accent-soft`, `--color-accent-text`, `--radius-card`, `--radius-button`, `--radius-input`). Для **The Spot** scoped block **`[data-brand="the-spot"]`**: `#f25130` accent, `#f5f2f0` page bg, `#242424` text, `rgb(36 36 36 / 60%)` muted, `#ffebe7` accent soft, `#b7614f` accent text, cards `12px`, pill controls `100px`.
- **Storefront primitives:** `globals.css` содержит brand-aware утилиты **`storefront-modal-*`** (bg/surface/field/soft/CTA/accent/mode-active/card-radius) для товара/корзины/доставки и **`storefront-checkout-*`** (card/form-panel/progress/toggle/address/success-hero) для checkout/success. Kitch по умолчанию остаётся на `#ffffff / #f2f2f2 / #ccff00 / #5f7600`, The Spot через `[data-brand="the-spot"]` переключается на warm bg, white surfaces и orange/accent-soft.
- **POS UI**: фон **страницы** — белый; **колонки** — серые острова **`#f2f2f2`** + `rounded-xl`; шапка приложения — тот же серый остров с белой кнопкой «Выйти». **Заказы:** заголовок «Заказы» (mono, semibold), **белая pill** с табами `variant="pos"` (активный `#242424` / белый текст); список — белые **карточки** с зазором, без обводки, выделение — **ring**; строка адреса на карточке — **`#f2f2f2`**. **Мастер заказа (`order-form.tsx`):** шапка прозрачная (нет собственного `bg`) — серый фон острова проявляется сквозь неё; кнопка `×` — белая плашка. Шаг 2: три модуля бок о бок — **«Оформление заказа»** (белая `rounded-xl` карточка, `flex-1`, лейбл 11px uppercase, табы категорий в `bg-[#f2f2f2]` pill, сетка с `rounded-full` фото товаров) + **«Корзина»** (белая `rounded-xl` карточка, `w-300px`, позиции с round-миниатюрой, счётчик `−/+`, lime CTA «К оформлению →»), зазор `gap-3`. Шаг 3: форма (белая карточка) + «Сводка» (белая карточка, `w-300px`). `PosCartItem.imageUrl?` — миниатюры в корзине и сводке.
- Витрина: без лишних теней на маркетинговых карточках; stuck category bar — лёгкая тень.
- Фото товаров/топпингов/промо: без серых подложек под изображение; плейсхолдер — обводка/текст. В сводке заказа на чекауте/успехе — миниатюры **`object-contain`** (прозрачный PNG без «серой подкладки»).
- Утилиты: `client-container`, `client-menu-grid`, `client-menu-card`, `tabular` (font-variant-numeric для чисел).

---

## API routes

| Route | Purpose |
|-------|---------|
| **`POST /api/upload`** | Session → Storage **`menu-images`**, `{ url }`. |

Геокодинг, валидация промокодов, **создание заказа** (**`createOrder`** / витрина, **`createOrderAdmin`** / админ, **`createOrderPos`** / касса POS), **загрузка заказов в админке**, **обновление статуса заказа** — **Server Actions** в `src/lib/actions/` (не отдельные REST-роуты для этих операций).

---

## External services (client-related)

- **Nominatim** (OpenStreetMap): поиск и reverse geocode; **`addressdetails=1`**; заголовок **`User-Agent: KitchPizza/1.0`**; поиск — `countrycodes=md`. Отображаемая строка адреса нормализуется через **`formatStreetLineFromNominatim`** (`src/lib/nominatim-format-street.ts`). Debounce ввода в модалке — **~800ms**; при совпадении текста с `resolvedAddress` повторный forward geocode не запускается.

---

## Planned features (summary)

- **Client:** уведомление заказа в **Telegram** (`tg_message_id`); в корзине — показать строку доставки вместо заглушки `-- лей`; галерея на витрине; апселл «Соусы / Напитки» из меню; выравнивание **`localStorage`** корзины/доставки с **`BrandConfig.cartKey` / `deliveryKey`** при нескольких витринах.
- **Admin:** lunch sets, gallery UI.
- **POS:** доработки оплаты/печати чека; расширение **`validatePromoCode`** под выбранный в мастере бренд (сейчас привязка к витрине по `getBrandId()`); сценарий **`createOrderAdmin`** из админки по-прежнему отдельно от **`createOrderPos`**.
- **Auth customers:** SMS / phone (future).

### Implemented recently (high level)

- **Дизайн-система POS / Admin (`DESIGN.md`):** задокументирована и внедрена дизайн-система Food Service — палитра 5 цветов (`#ffffff / #f2f2f2 / #242424 / #808080 / #ccff00`), шрифты Inter (400/700) + Roboto Mono (400/700); Noto Serif и Geist удалены; `globals.css` полностью переписан с монохромной oklch-палитрой; `app/layout.tsx` — новые шрифты; утилита `.tabular` для числовых данных.
- **POS — layout страницы (`pos/page.tsx`):** сетка **12 колонок** на **`bg-white`**; обе основные колонки — **`rounded-xl bg-[#f2f2f2]`** (визуальные «острова» на белом поле).
- **POS — шапка:** **`PosAppShell`** + правки **`pos/layout.tsx`** — клиентская оболочка с часами/таймером/выходом; серый **`rounded-2xl`** бар **`#f2f2f2`**, отступы `p-4`, кнопка «Выйти» на белом фоне (**`posHeaderCloseButtonClassName`**).
- **POS — Tabs `variant="pos"` (`tabs.tsx`):** dark-pill — активный `#242424` / белый текст, неактивный `#808080`; список заказов и категории меню используют **белую pill** на локальном сером фоне `#f2f2f2`.
- **POS — `orders-panel.tsx`:** заголовок «Заказы» (mono, tracking, **semibold**); белая pill для фильтров; список — **`gap-2`**, карточки на **`#f2f2f2`**.
- **POS — `order-card.tsx`:** белые **`rounded-lg`** карточки без рамки/тени; выделение — **ring**; адрес — полоса **`#f2f2f2`**; кнопки статусов — pill-стиль.
- **POS — `order-form.tsx` (UI рефакторинг):** три модуля по дизайн-системе: 1) **шапка** прозрачная (фон острова виден), grid 1fr/auto/1fr, кнопка `×` — белая плашка; 2) **«Оформление заказа»** — белая `rounded-xl` карточка с лейблом 11px uppercase, табами категорий в `bg-[#f2f2f2]` pill, сеткой товаров (`rounded-full` фото); 3) **«Корзина»** — белая `rounded-xl` карточка `w-300px` с миниатюрами (новое поле **`PosCartItem.imageUrl?`**), счётчиком `−/+`, подытогом и lime CTA; зазор между карточками `gap-3`. **Шаг 3** — форма с секциями-карточками «Тип заказа» / «Контактные данные» / «Метод оплаты» / «Дополнительно»; поле адреса с debounce 800 мс + проверка зоны доставки (`checkDeliveryZoneByAddress`) — инфо-блок с тарифами + динамический `deliveryFee`; CTA — лаймовая кнопка на всю ширину.

- **Multi-brand:** таблица **`brands`**, **`brand_id`** на контентных таблицах; **`src/brands`**, middleware **`x-brand-slug`**, **`getBrand` / `getBrandId`** на витрине и в **`createOrder`**; в админке — кука **`admin-brand-slug`**, **`getAdminBrandId`**, **`BrandSwitcher`**, все админские CRUD/страницы заказов с фильтром по бренду; **`createOrderAdmin`** для сценария кассы.
- **Kitch POS (данные и auth):** **`/pos`**, **`/pos/login`**; PIN + JWT (**`jose`**), **`bcryptjs`**; **`shift_logs`**; actions **`pos/auth`**, **`pos/shifts`**, **`pos/create-order-pos`**, **`pos/check-delivery-zone-pos`**; **`fetch-orders.ts`**, **`types/pos.ts`**; миграции **`orders.source`**, **`orders.operator_id`**, **`orders.user_birthday`**; `ensureActiveShift` — устойчив к дублям открытых смен; **`pos-clock-widget`** (время после mount); **`components/ui/alert.tsx`** на логине PIN. (Вёрстка и shell — см. таблицу **«Kitch POS»** и пункты выше.)
- **Заказы (витрина):** сохранение с чекаута через **`createOrder`** → таблицы **`orders`** / **`order_items`** (service role); редирект на успех с **`order`** = номер заказа.
- **Заказы (админка):** **`/admin/orders`** — фильтры в query, **`getOrders`** + **`parseOrdersSearchParams`** / **`ordersCreatedAtBounds`**, таблица и диалог деталей, **`updateOrderStatus`** + Sonner; деньги в UI: **bani ÷ 100** и строка «… лей».
- **Checkout / success:** общие **`OrderSummary`**, **`CheckoutProgressSteps`**; `checkout/page.tsx` и `success/page.tsx` получают бренд через **`getBrand()`**, логотип в шапке ведёт на `/`, кнопка назад — белая. Checkout использует brand-aware primitives (`storefront-checkout-*`): The Spot получает белую form-panel и orange toggles/CTA, Kitch остаётся lime/gray. Выбор времени: после **«Указать время»** сначала быстрые интервалы от текущего времени (`+1:00`…`+2:00`, округление до 15 мин), отдельная кнопка открывает кастомный dropdown. Страница успеха с brand-aware hero, **`Vector.svg`**, Leaflet-картой (тайлы **`leaflet-storefront-tiles.ts`**, координаты из **`delivery-store`**); обработка ошибок и loading на submit.
- **Карты (витрина):** общие тайлы Carto в **`leaflet-storefront-tiles.ts`**; иконка пина **`Address_Pin_Geo.svg`**; защита от `zones === undefined` на **`DeliveryMap`**.
- **Dev:** по умолчанию **`next dev --turbo`**; **`dev:webpack`** для отката; **`dev:clean`** при битом `.next`; **`next.config`**: отключение Webpack cache в dev.
- **The Spot storefront:** `src/brands/index.ts` добавил `the-spot` (`thespot.md`, `www.thespot.md`) и `losos` (`losos.md`, `www.losos.md`); `getBrandByHost()` режет порт из `Host`, чтобы локальный `http://thespot.md:3000/` резолвился в `the-spot`. The Spot mobile theme и layout собраны по Figma node `52:140`: логотип, mobile header, промо placeholders, category pills, 2-col menu cards и floating cart. Tablet/desktop The Spot (`md+`) тоже brand-specific: отдельный rounded-full header, sticky pill-категории с оранжевой корзиной, промо placeholders/cards `16/7`, меню 3 колонки на tablet и 4 на wide desktop, карточки с белыми image cards и MDL price pill. Product/cart/delivery modal + checkout/success переведены на brand-aware primitives: warm bg `#f5f2f0`, white surfaces, orange CTA/accent.
- **Menu category UX:** `MenuCategoryBar` + `MenuSection` получили anchors `menu-category-{slug}`. Клик по категории делает smooth scroll с offset под sticky header, scroll-spy подсвечивает текущую категорию, mobile horizontal list плавно прокручивается к активной кнопке. Работает для The Spot и Kitch. В Kitch mobile cart pill убран из sticky header и заменён bottom floating cart по структуре The Spot, но с lime CTA.
- **Admin brand switcher:** список брендов в сайдбаре больше не берётся из `src/brands`; `getBrands()` читает активные `brands` из Supabase, `BrandSwitcher` остаётся client component и вызывает `setAdminBrand(slug)` + `router.refresh()`. `getAdminBrandSlug()` валидирует cookie через таблицу `brands`, а не через storefront config.
- **delivery-modal:** **`DeliveryMap`** не реэкспортируется из **`index.ts`** (SSR + `leaflet`). Mobile delivery sheet переписан с `vaul` на custom fullscreen fixed dialog: закрытие только X/«Выбрать», карта Leaflet двигается свайпом, zoom-кнопки на mobile — bottom-left.
- Корзина: промокоды (server validation), доставка в итоге через **`delivery-store`**; строка «Доставка» в UI корзины — по-прежнему заглушка `-- лей`. Редактирование позиции из корзины: **`product-modal-store.openForEdit`** / **`returnToCart`**.
- Модалка адреса: desktop split / mobile fullscreen dialog; **`ring-inset`** вне зоны; без server actions в **`onRehydrateStorage`** у delivery persist.
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
# POS (JWT подпись, минимум 32 символа):
POS_SESSION_SECRET=
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
- Локальная проверка The Spot: добавить в `/etc/hosts` `127.0.0.1 thespot.md www.thespot.md`, затем открыть **`http://thespot.md:3000/`**. Важно: браузер отправляет `Host: thespot.md:3000`, поэтому `getBrandByHost()` нормализует host без порта.
- Не дублировать **`import` globals.css** в `(client)/layout` и root — один импорт в **`app/layout.tsx`**.
- **`next.config.mjs`:** в режиме Webpack dev отключён **filesystem cache** (`webpack` → `config.cache = false` при `dev`) — стабильнее HMR; при **`next dev --turbo`** этот хук не используется. Сообщение **«Webpack is configured while Turbopack is not»** — см. [документацию `turbo` в `next.config`](https://nextjs.org/docs/app/api-reference/next-config-js/turbo); при сбоях парсинга в Turbo можно временно запустить **`npm run dev:webpack`**.
- **Turbopack + большие TSX:** избегать хвоста **`form.handleSubmit(async (...) => { ... })`** сразу перед следующим **`return`/`const`** с JSX — надёжнее именованный handler + **`form.handleSubmit(submitCheckout)`** (как в **`order-form.tsx`**).
