# Kitch! Food Delivery

Краткая техническая памятка по проекту: multi-brand витрина доставки еды, админка и POS в одном Next.js приложении.

## Что это

- **Витрины:** `kitch-pizza`, `losos`, `the-spot`.
- **Админка:** `/admin/*`, Supabase Auth, CRUD контента и заказов.
- **POS:** `/pos/*`, отдельный вход по PIN, смены, создание и редактирование заказов.
- **Валюта:** MDL; все суммы в БД хранятся integer bani, в UI показываются как lei.
- **Языки витрины:** RU / RO через Zustand store и поля `*_ru` / `*_ro`; **язык по умолчанию — RO** (`DEFAULT_LANG` в `src/lib/i18n/storefront.ts`, persist key `lang` в localStorage).

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
| UI extras | Sonner, Swiper, Vaul, Lucide, Motion, web-haptics |

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
│   ├── topping-max-selection.ts  # лимит выбора топпингов по группе (витрина + POS)
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

- Главная: промо, featured items для boutique брендов, категории и меню. Полоса категорий: `src/components/client/menu-category-bar.tsx` (sticky, скролл к секциям по `slug`); у **losos** и **the-spot** кнопки категорий без декоративных иконок.
- **Шапка (мобилка):** `src/components/client/main-header.tsx`. У **the-spot / losos** в закрытом состоянии одна капсула: логотип, кнопка адреса (открывает модалку доставки), бургер. **Открытое меню** (`MobileFullMenuOverlay`, `<md`): полноэкранный слой на фоне `#F5F2F0` — верхняя белая полоса (логотип, переключатель RO/RU, закрытие), ниже кнопка адреса, внизу закреплённая **`tel:`**-кнопка звонка; пункты навигации «Меню / Акции / …» в оверлее не показываются. У **kitch-pizza** закрытая шапка прежняя (бургер, лого, телефон + баннер доставки); оверлей — тот же компонент.
- **Модалка товара:** `src/components/client/product-modal/ProductModalRoot.tsx` — топпинги группируются по `topping_groups` с заголовком группы (данные `fetchStorefrontMenuItemToppingGroups` в `src/lib/data/storefront-item-toppings.ts`). Учитывается лимит выбора на группу (`topping_groups.max_selections`, см. админку). На мобилке фото блюда визуально меньше (~`w-[70%]` относительно контейнера, `max-w-[315px]`).
- Корзина: `cart-store`, localStorage key `kitch-cart`, TTL 7 дней, промокоды через `validatePromoCode`.
- Доставка: `delivery-store`, localStorage key `kitch-delivery`, зоны по полигонам, геокодинг через Nominatim.
- Checkout: `createOrder`, `OrderSummary`, `CheckoutProgressSteps`, success page с картой (`checkout-success-view`, `checkout-success-map`).
- **Успешный заказ:** `src/components/client/checkout/checkout-success-view.tsx` — блок героя со стилизацией `storefront-checkout-success-hero` в `globals.css`; декоративная иллюстрация `/Vector.svg` только у **kitch-pizza**. У брендов **losos** и **the-spot** декор не показывается, текст без правых отступов под графику.
- i18n: `src/lib/store/language-store.ts` и `src/lib/i18n/storefront.ts`; на маршрутах витрины `ClientChrome` синхронизирует `document.documentElement.lang` с выбранным языком.
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
| `/admin/menu` | позиции меню, размеры, скидки, теги, топпинги; **фильтр по категории и поиск** (название, описание RU/RO, категория) на клиенте в `menu-table.tsx` |
| `/admin/featured-menu` | блок «Новое и популярное» |
| `/admin/toppings` | группы топпингов и топпинги; можно создать новый топпинг или скопировать уже существующий в выбранную группу; у группы — **«Безлимит»** (по умолчанию) или число «сколько можно выбрать» → колонка `topping_groups.max_selections` |
| `/admin/promotions` | промо-баннеры RU/RO |
| `/admin/promo-codes` | промокоды |
| `/admin/delivery-zones` | несколько зон доставки, полигоны Leaflet Draw, цвет зоны, цена/минималка/время |

Примечания:

- Топпинг физически принадлежит одной группе через `toppings.group_id`. Действие «Существующий» в `/admin/toppings` создаёт **копию** топпинга в текущей группе, не переносит оригинал; дубликаты с тем же `name_ru` / `name_ro` / `price` в группе блокируются.
- У группы топпингов поле **`max_selections`**: `NULL` — без лимита (можно выбрать несколько), число ≥ 1 — максимум позиций из этой группы в одной позиции заказа; логика в `src/lib/topping-max-selection.ts` на витрине (`ProductModalRoot`) и в POS (`pos-product-modal.tsx`). Миграция: `supabase/migrations/*_topping_group_max_selections.sql`.
- Зоны доставки хранят HEX-цвет в `delivery_zones.color` (колонка в БД; миграция `supabase/migrations/*_add_delivery_zone_color.sql`). Форма валидирует `#RRGGBB`, карты админки и витрины рисуют полигоны в цвете зоны.

## POS

- URL: `/pos/login` для PIN, `/pos` для рабочей зоны.
- Auth: `src/lib/actions/pos/auth.ts`, cookie `pos-session`, JWT HS256, секрет `POS_SESSION_SECRET`.
- Смены: `src/lib/actions/pos/shifts.ts`, таблица `shift_logs`; открытая смена закрывается при logout.
- Корневая зона `src/app/pos/page.tsx`: левая панель заказов, справа — состояние **idle / detail / create / add-items** (режим добавления строк к уже оформленному заказу).
- Клиентские данные POS: `src/lib/pos/fetch-orders.ts`, типы `src/types/pos.ts`.
- **Supabase Realtime (POS):** в публикацию `supabase_realtime` должны входить `public.orders` и `public.order_items` (DDL в `supabase/migrations`, например `*_enable_pos_orders_realtime`). Иначе события `postgres_changes` в браузере не придут и список обновится только после перезагрузки.
- **Список заказов:** `src/components/pos/orders-panel.tsx` — подписка на `INSERT`/`UPDATE` таблицы `orders`, повторная выборка строки и короткая повторная догрузка после вставки (чтобы подтянулся `item_count` после `order_items`).
- **Карточка заказа:** `src/components/pos/order-detail.tsx` — Realtime: `UPDATE` по строке `orders` и изменения в `order_items` с фильтром `order_id`; верстка: данные клиента / доставка / служебное слева, справа блок «Данные о заказе» со списком строк (количество ±, свайп влево открывает красную кнопку удаления; не ниже одной строки), сводка подытог / доставка / скидка / итог, кресток закрытия с белым фоном (`posHeaderCloseButtonClassName`).
- **Новый заказ:** мастер `src/components/pos/order-form.tsx` — шаг 1 (бренды из `brands`), шаг 2 (меню + корзина), шаг 3 (оформление). Создание: `createOrderPos`, `source = 'pos'`, `operator_id` из текущей сессии; в `order_items` сохраняются топпинги JSON вместе с позицией.
- **Добавление к сохранённому заказу:** из `OrderDetail` кнопка «Добавить к заказу» переводит панель в `add-items` и открывает тот же `OrderForm` сразу на шаге 2 (`extendOrderId`, `addOrderItemsPos`) — только новые позиции из корзины пишутся в существующий `orders.id`, пересчитывается `total`.
- **Правка позиции:** кнопка «Изменить» (если у строки есть `menu_item_id`) или клик по строке в POS-корзине открывает `PosProductModal`; для сохранённых строк вызывается `updateOrderItemCompositionPos` (размер, топпинги, количество, пересчёт цены строки и заказа), для черновика корзины строка заменяется локально. Выбор топпингов в модалке учитывает **`topping_groups.max_selections`** (как на витрине).
- **POS-корзина:** строки в `OrderForm` имеют компактную двухрядную верстку; удаление — через `src/components/pos/swipe-to-delete.tsx` (свайп только раскрывает кнопку, само удаление по нажатию на неё).
- Server Actions для строк заказа: `src/lib/actions/pos/update-order-items.ts` — `updateOrderItemQuantityPos`, `removeOrderItemPos`, `addOrderItemsPos`, `updateOrderItemCompositionPos`.

## Данные и БД

Основные таблицы:

- `brands` — slug, name и UUID бренда.
- `menu_categories`, `menu_items`, `topping_groups` (**`max_selections`** — лимит выбора из группы, `NULL` = без лимита), `toppings`, `menu_item_topping_groups`.
- `promotions`, `featured_menu_items`.
- `promo_codes`.
- `delivery_zones` — `polygon` JSONB как массив `[lat, lng]`, `color` (TEXT, HEX `#RRGGBB`, default) для отрисовки полигона, цена/минималка/время доставки.
- `orders`, `order_items`.
- `profiles`, `otp_codes` — storefront phone auth.
- `staff`, `shift_logs` — POS.

Правила:

- Контентные таблицы содержат `brand_id`; витрина и админка обязаны фильтровать по текущему бренду.
- Дочерние таблицы без `brand_id` фильтруются через родительские сущности.
- Денежные поля (`total`, `price`, `discount`, `delivery_fee`, `*_bani`) хранятся в банях.
- Записи, которые обходят RLS, выполняются через service role client в `src/lib/supabase/service-role.ts`.
- **Realtime Postgres Changes:** для подписки из клиента нужны включённые таблицы в публикации `supabase_realtime` и возможность клиента читать строки (или RLS будет скрывать события). Для локальной истории см. файлы в `supabase/migrations/`; продакшен применять через Supabase MCP/CLI/dashboard согласно процессу команды.

## Миграции Supabase

- SQL для схемы хранится в `supabase/migrations/` и должен синхронизироваться с подключённым проектом.
- Типичные добавления: колонка `delivery_zones.color`; `topping_groups.max_selections`; публикация Realtime для `orders` и `order_items`.

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
- Стартовый язык до гидрации и для новых гостей: **RO** (`DEFAULT_LANG`).
- Словари и helpers: `src/lib/i18n/storefront.ts`; дефолт языка в `getCartItemSummary` и т.п. согласован с `DEFAULT_LANG`.
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
