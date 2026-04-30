# Kitch! Food Delivery

Краткая техническая памятка по проекту: multi-brand витрина доставки еды, админка и POS в одном Next.js приложении.

## Что это

- **Витрины:** `kitch-pizza`, `losos`, `the-spot`.
- **Админка:** `/admin/*`, Supabase Auth, CRUD контента и заказов.
- **POS:** `/pos/*`, отдельный вход по PIN, смены, создание и редактирование заказов.
- **Валюта:** MDL; все суммы в БД хранятся integer bani, в UI показываются как lei.
- **Языки витрины:** RU / RO через Zustand store и поля `*_ru` / `*_ro`.

## Стек

| Область | Используется |
|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI, `tw-animate-css` |
| Data | Supabase PostgreSQL, Auth, Storage, Realtime |
| State | Zustand |
| Forms / validation | React Hook Form, Zod |
| Maps | Leaflet, Leaflet Draw, Nominatim |
| POS auth | `jose` JWT + `bcryptjs` PIN |
| UI extras | Sonner, Swiper, Vaul, Lucide, web-haptics |

## Архитектура

```txt
src/
├── app/
│   ├── (client)/        # публичная витрина и checkout
│   ├── (admin)/admin/   # админка
│   ├── pos/             # POS
│   ├── api/             # upload + storefront phone auth
│   ├── globals.css      # единственный импорт глобальных стилей
│   └── layout.tsx       # root layout, fonts, brand favicon
├── brands/              # BrandConfig и host -> brand
├── components/
│   ├── client/
│   ├── admin/
│   ├── pos/
│   └── ui/              # shadcn/ui
├── lib/
│   ├── actions/         # server actions
│   ├── brand-phone.ts   # номер для витрины + tel:, из BrandConfig
│   ├── data/            # storefront fetchers
│   ├── i18n/
│   ├── pos/
│   ├── store/
│   └── supabase/
├── types/
└── middleware.ts
```

## Multi-brand

- Канонический конфиг брендов: `src/brands/index.ts`.
- `middleware.ts` резолвит бренд по `Host` или локальным алиасам `/losos`, `/thespot`, затем ставит `x-brand-slug` и `x-pathname`.
- Витрина читает бренд через `getBrand()` / `getBrandId()`; `(client)/layout` выставляет `data-brand`.
- Админка не зависит от домена: активный бренд хранится в cookie `admin-brand-slug`, UUID берётся через `getAdminBrandId()`.
- Контентные таблицы фильтруются по `brand_id`.

Текущие бренды (в `BrandConfig.phone` задаётся отображение на кнопках звонка; `getBrandPhoneHref` строит `tel:+373…` для MDL номеров с ведущим `0`):

| Slug | Domain / dev | Телефон (витрина) | Logo |
|---|---|---|---|
| `kitch-pizza` | `kitch-pizza.md`, `localhost:3000` | `079 700 290` | `/kitch-pizza-logo.svg` |
| `losos` | `losos.md`, `www.losos.md` | `079 200 190` | `/Losos_Logo.svg` |
| `the-spot` | `thespot.md`, `192.168.50.137` | `079 200 120` | `/the-spot-logo.svg` |

## Витрина

- Главная: промо, featured items для boutique брендов, категории и меню.
- Корзина: `cart-store`, localStorage key `kitch-cart`, TTL 7 дней, промокоды через `validatePromoCode`.
- Доставка: `delivery-store`, localStorage key `kitch-delivery`, зоны по полигонам, геокодинг через Nominatim.
- Checkout: `createOrder`, `OrderSummary`, `CheckoutProgressSteps`, success page с картой.
- i18n: `src/lib/store/language-store.ts` и `src/lib/i18n/storefront.ts`.
- Haptics: `StorefrontHaptics` подключается только на витрине и checkout; отключение через `data-haptics="off"`.
- Телефон в шапке и блоке успеха checkout: из `getBrandPhone(brandSlug)` (`src/lib/brand-phone.ts`), не общий текст из словаря.
- Скелетоны переходов: `src/components/client/storefront-skeletons.tsx` — **StorefrontHomeSkeleton** по `brandSlug` (boutique vs Kitch разная верстка), **CheckoutSkeleton** для checkout/hydrate; **`src/app/(client)/loading.tsx`** и **`src/app/(client)/checkout/loading.tsx`** читают заголовок `x-brand-slug` и пробрасывают бренд.

Важное про Leaflet: компоненты с `leaflet` подключать только client-side через `dynamic(..., { ssr: false })`; не реэкспортировать карту из barrel-файлов, если это ломает SSR.

## Админка

- Auth: Supabase email/password.
- Защита: middleware редиректит `/admin/*` без сессии на `/admin/login`.
- Навигация начинается с `/admin/orders`, далее категории, меню, featured, toppings, promotions, promo codes, delivery zones.
- Все CRUD операции должны работать в контексте `getAdminBrandId()`.
- Заказы грузятся server-side через `getOrders`; смена статуса через `updateOrderStatus`.
- Загрузка изображений идёт через `POST /api/upload` в публичный bucket `menu-images`.

Основные разделы:

| Route | Назначение |
|---|---|
| `/admin/orders` | список, фильтры, детали и статусы заказов |
| `/admin/categories` | категории меню |
| `/admin/menu` | позиции меню, размеры, скидки, теги, топпинги |
| `/admin/featured-menu` | блок «Новое и популярное» |
| `/admin/toppings` | группы топпингов и топпинги |
| `/admin/promotions` | промо-баннеры RU/RO |
| `/admin/promo-codes` | промокоды |
| `/admin/delivery-zones` | зоны доставки и полигоны |

## POS

- URL: `/pos/login` для PIN, `/pos` для рабочей зоны.
- Auth: `src/lib/actions/pos/auth.ts`, cookie `pos-session`, JWT HS256, секрет `POS_SESSION_SECRET`.
- Смены: `src/lib/actions/pos/shifts.ts`, таблица `shift_logs`; открытая смена закрывается при logout.
- Корневая зона `src/app/pos/page.tsx`: левая панель заказов, справа — состояние **idle / detail / create / add-items** (режим добавления строк к уже оформленному заказу).
- Клиентские данные POS: `src/lib/pos/fetch-orders.ts`, типы `src/types/pos.ts`, Realtime для списка и карточки заказа.
- **Новый заказ:** мастер `src/components/pos/order-form.tsx` — шаг 1 (бренды из `brands`), шаг 2 (меню + корзина), шаг 3 (оформление). Создание: `createOrderPos`, `source = 'pos'`, `operator_id` из текущей сессии; в `order_items` сохраняются топпинги JSON вместе с позицией.
- **Добавление к сохранённому заказу:** из `OrderDetail` кнопка «Добавить к заказу» переводит панель в `add-items` и открывает тот же `OrderForm` сразу на шаге 2 (`extendOrderId`, `addOrderItemsPos`) — только новые позиции из корзины пишутся в существующий `orders.id`, пересчитывается `total`.
- **Карточка заказа:** `src/components/pos/order-detail.tsx` — данные клиента / доставка / служебное слева, справа блок «Данные о заказе» со списком строк (количество ±, удаление с ограничением «не ниже одной строки»), сводка подытог / доставка / скидка / итог внизу белой карточки, кресток закрытия с белым фоном (`posHeaderCloseButtonClassName`).
- **Правка позиции:** кнопка «Изменить» (если у строки есть `menu_item_id`) открывает `PosProductModal` в режиме правки сохранённой строки и вызывает `updateOrderItemCompositionPos` (размер, топпинги, количество, пересчёт цены строки и заказа).
- Server Actions для строк заказа: `src/lib/actions/pos/update-order-items.ts` — `updateOrderItemQuantityPos`, `removeOrderItemPos`, `addOrderItemsPos`, `updateOrderItemCompositionPos`.

## Данные и БД

Основные таблицы:

- `brands` — slug, name и UUID бренда.
- `menu_categories`, `menu_items`, `topping_groups`, `toppings`, `menu_item_topping_groups`.
- `promotions`, `featured_menu_items`.
- `promo_codes`.
- `delivery_zones` — polygon JSONB как массив `[lat, lng]`.
- `orders`, `order_items`.
- `profiles`, `otp_codes` — storefront phone auth.
- `staff`, `shift_logs` — POS.

Правила:

- Контентные таблицы содержат `brand_id`; витрина и админка обязаны фильтровать по текущему бренду.
- Дочерние таблицы без `brand_id` фильтруются через родительские сущности.
- Денежные поля (`total`, `price`, `discount`, `delivery_fee`, `*_bani`) хранятся в банях.
- Записи, которые обходят RLS, выполняются через service role client в `src/lib/supabase/service-role.ts`.

## Server Actions и API

Server Actions в `src/lib/actions/`:

- `create-order.ts` — заказ с витрины.
- `create-order-admin.ts` — заказ из админки.
- `validate-promo-code.ts`.
- `check-delivery-zone.ts`.
- `get-orders.ts`, `update-order-status.ts`.
- `get-brands.ts`, `set-admin-brand.ts`.
- `account/update-profile.ts`.
- `pos/*` — auth, shifts, `create-order-pos`, `update-order-items` (количество, удаление, добавление строк к заказу, смена состава строки), zone check и др.

API routes:

| Route | Назначение |
|---|---|
| `POST /api/upload` | загрузка файлов в Supabase Storage |
| `POST /api/auth/send-otp` | отправка OTP через SMS.md |
| `POST /api/auth/verify-otp` | проверка OTP и cookie `storefront-session` |
| `GET /api/auth/me` | текущий storefront profile |
| `POST /api/auth/logout` | очистка storefront session |

## i18n

- Язык витрины: `src/lib/store/language-store.ts`, persist key `lang`.
- Словари и helpers: `src/lib/i18n/storefront.ts`.
- Динамические названия берутся через `pickLocalizedName` / `pickLocalizedDescription`.
- Server action `createOrder` принимает язык, чтобы сохранить snapshot заказа и вернуть ошибки на выбранном языке.

## Дизайн и стили

- Источник правил: `DESIGN.md`.
- Палитра Food Service: `#ffffff`, `#f2f2f2`, `#242424`, `#808080`, `#ccff00`.
- Шрифты: Inter 400/700 и Roboto Mono 400/700 из `src/app/layout.tsx`.
- Глобальные токены и brand-scoped CSS variables находятся в `src/app/globals.css`.
- Для storefront использовать brand-aware primitives (`storefront-modal-*`, `storefront-checkout-*`) вместо локального дублирования цветов.
- `globals.css` импортируется только в `src/app/layout.tsx`.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

POS_SESSION_SECRET=

SMS_MD_API_KEY=
SMS_MD_SENDER=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`POS_SESSION_SECRET` должен быть не короче 32 символов.

## npm scripts

| Script | Command |
|---|---|
| `npm run dev` | `next dev --turbo` |
| `npm run dev:webpack` | `next dev` |
| `npm run dev:clean` | `rm -rf .next && next dev --turbo` |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `next lint` |

## Dev notes

- Если `.next` ломается (`404` на chunks/CSS или `Cannot find module './NNN.js'`), использовать `npm run dev:clean`.
- Не запускать два `next dev` на одном проекте одновременно: второй часто уходит на `3001`, а браузер остаётся на `3000`.
- Для локальной проверки доменов добавить в `/etc/hosts`: `127.0.0.1 losos.md www.losos.md thespot.md www.thespot.md`.
- Для проверки с телефона в одной Wi-Fi сети: `npm run dev -- -H 192.168.50.137` и открыть `http://192.168.50.137:3000/`.
- При проблемах с Turbopack можно временно перейти на `npm run dev:webpack`.

## Ближайшие TODO

- Показать фактическую строку доставки в корзине вместо `-- лей / -- lei`.
- Выровнять localStorage keys корзины/доставки с `BrandConfig.cartKey` / `deliveryKey`.
- При необходимости подтянуть подпись «Позвонить …» в `storefront.ts` под бренд или оставить динамику только в `aria-label` через `getBrandCallLabel`.
- Включить storefront phone auth UI и checkout guard после готовности UX.
- Расширить `validatePromoCode` для POS под выбранный в мастере бренд.
- Доработать gallery и lunch sets в админке.
