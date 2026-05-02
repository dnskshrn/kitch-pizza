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
│   ├── (admin)/admin/   # админка; кондименты: admin/condiments/
│   ├── pos/             # POS
│   ├── api/             # upload, storefront phone auth, PBX webhook (входящие звонки)
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
├── types/               # в т.ч. `PosOrder`, `PosWizardBrandOption`, storefront DB types
└── middleware.ts
```

## Multi-brand

- Канонический конфиг брендов: `src/brands/index.ts`; для POS и значений **`brand_slug`** из БД используются **`normalizePosBrandSlug`** (алиасы вроде `thespot` → **`the-spot`**) и **`getBrandBySlug`** с учётом нормализации.
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
- **Модалка товара:** `src/components/client/product-modal/ProductModalRoot.tsx` — топпинги группируются по `topping_groups` с заголовком группы (данные `fetchStorefrontMenuItemToppingGroups` в `src/lib/data/storefront-item-toppings.ts`). Учитывается лимит выбора на группу (`topping_groups.max_selections`, см. админку). На мобилке фото блюда визуально меньше (~`w-[70%]` относительно контейнера, `max-w-[315px]`). Если у позиции непустой **`menu_items.included_items`** (`{ name_ru, name_ro }[]`), между описанием и блоком размеров показывается секция **«Входит в заказ»** / локализованный заголовок — чипы с цветным индикатором по ключевым словам (васаби / имбирь / соус / палочки).
- Корзина: `cart-store`, localStorage key `kitch-cart`, TTL 7 дней, промокоды через `validatePromoCode`. В сторе также **`condimentQuantities`** и **`condimentsMeta`** (имена + цена за ед. в банях для строк заказа). Модалка корзины: `CartContent` / `CartSheet` — заголовок с числом позиций и кнопкой закрытия в одной строке (`CartContent.tsx`). Блок **«Добавить ещё»** (кондименты): при открытии корзины один раз грузятся активные **`menu_items`** из категорий с **`is_condiment = true`**, с фильтром **`brand_id`** текущей витрины (slug из **`[data-brand]`** в `(client)/layout`, тот же контекст, что **`x-brand-slug`** / `getStorefrontMenu`). Секция **не рендерится**, если список пустой — для брендов без кондиментов лишнего UI нет. Степперы и строки в `order_items` при оформлении: **`createOrder`** дополняет вставку позиций корзины строками кондиментов (`condimentOrderLines`, см. `buildCondimentOrderLines` в `src/lib/cart-helpers.ts`). Субтотал корзины и промо учитывают кондименты (`computeCartGoodsSubtotalBani`).
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
- Боковое меню (`AdminSidebar`): группы **shadcn** `SidebarGroup` / `SidebarGroupLabel` / `SidebarGroupContent` — **Аналитика** (заказы), **Меню** (категории, позиции `/admin/menu`, новое и популярное, топпинги, **кондименты `/admin/condiments`**), **Маркетинг** (акции, промокоды), **Доставка** (зоны). Пункт «Галерея» из навигации убран (маршрут страницы при наличии может оставаться).
- Все CRUD операции должны работать в контексте `getAdminBrandId()`.
- Заказы грузятся server-side через `getOrders`; смена статуса через `updateOrderStatus`. В списке и фильтрах доступны все актуальные статусы (включая черновик, отменён, отклонён); в модалке деталей заказа для отмен/отказов показывается **`cancel_reason`**, адрес — **`delivery_address`** плюс отдельные поля **`address_*`**, если заполнены.
- Загрузка изображений идёт через `POST /api/upload` в публичный bucket `menu-images`.

Основные разделы:

| Route | Назначение |
|---|---|
| `/admin/orders` | список, фильтры, детали и статусы заказов |
| `/admin/categories` | категории меню: отдельные поля **название RU** и **название RO**; slug из RU; в таблице и в выборе категории в меню отображаются оба языка |
| `/admin/menu` | позиции меню, размеры, скидки, теги, топпинги; **фильтр по категории и поиск** (название, описание RU/RO, категория) на клиенте в `menu-table.tsx` |
| `/admin/condiments` | позиции **только** в категории-кондименте: на сервере **`ensureCondimentCategory`** — если нет строки **`menu_categories`** с **`is_condiment = true`**, создаётся категория RU/RO «Кондименты» · «Condimente», `slug: condiments`. Форма как у меню, но **без выбора категории**; переключатель **«Добавить в заказ автоматически»** → **`menu_items.is_default_condiment`**. Запись через **`(supabase.from('menu_items') as any)`** для `is_default_condiment` и `included_items`. Топпинги: чтение **`getMenuItemToppingGroups`** из `admin/menu/actions`, сохранение связей — `setCondimentMenuItemToppingGroups` в `admin/condiments/actions.ts` с revalidate **`/admin/condiments`**. |
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
- **Шапка POS:** логотип **Food Service** — **`PosFoodServiceLogo`** (`src/components/pos/pos-food-service-logo.tsx`), ассет **`public/food-service-pos-logo.svg`**; в **`PosAppShell`** и на **`/pos/login`** вместо надписи «Kitch POS».
- **Высота экрана (без внешнего скролла):** после логина оболочка **`PosAppShell`** (`src/components/pos/pos-app-shell.tsx`) — **`h-screen` + `overflow-hidden`**, шапка **`shrink-0`** (блок **`p-4` + высота строки **`h-14`** ≈ 72px до контента **`main`**), области контента ниже — **`min-h-0`**, **`overflow-hidden`**, скролл только внутри панелей списка заказов, мастера, корзины/сводки. Страница **`src/app/pos/page.tsx`**: **`h-full` / `flex-1`**, колонки сетки **`h-full min-h-0 overflow-hidden`**.
- Корневая страница `src/app/pos/page.tsx`: слева список заказов (**`OrdersPanel`**, `forwardRef` + **`OrdersPanelHandle`**: **`updateOrderLocalState`** для живого отображения карточки при вводе на шаге «Детали»; **`refetchOrders()`** — полная перезагрузка списков активных и выданных заказов с сервера). Опциональный колбэк **`onMainOrdersChange(mainOrders)`** синхронизирует у родителя **`mainOrdersSnapshot`** — по нему в мастер передаётся **`listOrder`** (активный **`PosOrder`** для текущего **`orderId`**). При монтировании страницы один раз запрашиваются строки **`brands`** (`id`, `name`, `slug`) через клиентский Supabase и склеиваются с каноническим **`BrandConfig`** из **`src/brands/index.ts`** в массив **`wizardBrands`** (**тип `PosWizardBrandOption`** в **`src/types/pos.ts`**: конфиг витрины + **`dbId`** из БД); **`wizardBrands`** пробрасываются в **`OrderForm`** вместе с **`listOrder`**. Справа состояние **idle** (подсказка + «Новый заказ»), **wizard** (мастер **`OrderForm`**, ref панели **`ordersPanelRef`**) или **detail** (`OrderDetail` только чтение для заказа со статусом **`done`**). Выбор строки списка: по статусу открывается мастер или просмотр (`src/lib/pos/order-wizard-status.ts`, `fetchPosOrderById`). Новый заказ: **`createDraftOrderPos`** из `create-draft-order.ts` → мастер с новым черновиком. У **`OrdersPanel`**: кнопка «Выданные» в шапке списка — без белого фона и тени, иконка серым (**`#808080`**); выделенная **`OrderCard`** — **`ring-inset`**, чтобы обводка не обрезалась при **`overflow`**. Марки брендов в карточках: **`PosBrandMark`** рендерит локальные SVG из **`/public`** через **`<img>`** (не **`next/image`**).
- Заказы в POS: **`src/lib/pos/fetch-orders.ts`** — константа **`ORDERS_POS_SELECT`** + вложения **`brands(slug)`**, **`order_items(count)`**. В **`PosOrder`** попадают в том числе **`payment_method`**, **`change_from`**, **`promo_code`** (для карточек и синхронизации формы «Детали» из **`listOrder`**). Если slug из join отсутствует (**`null`**, пустой массив или пустая строка), но задан **`brand_id`**, выполняется запрос **`brands(id, slug)`** по нужным id; **`mapOrderRowToPosOrder`** применяет **`normalizePosBrandSlug`**. Основной список за последние 24 ч, статусы **`MAIN_POS_ORDER_STATUSES`**: `draft`, `new`, `in_progress`, `delivering`; архив «Выданные» — **`fetchCompletedPosOrders`**: **`done`**, по `updated_at`, limit 50. Канон статусов: `src/types/pos.ts` — **`draft` | `new` | `in_progress` | `delivering` | `done` | `cancelled` | `rejected`**.
- **Realtime (POS):** публикации **`orders`** и **`order_items`** в `supabase_realtime` обязательны. В **`orders-panel.tsx`** два канала на клиентском **`createClient()`**: **`pos-orders`** (`postgres_changes`, `event: '*'`, таблица `orders`) — на каждое событие **`reloadOrders()`**; при **`INSERT`** дополнительно звук **`/pos-new-order-chime.wav`** (файл в **`public/`**); **`pos-order-items`** (`event: '*'`, таблица **`order_items`**) — на каждое событие **`reloadOrders()`**. После **`reloadOrders`** список пересобирается из **`fetchPosOrders`** / **`fetchCompletedPosOrders`** с функцией **`mergeOrdersPreserveBrandSlug`**, чтобы не терять **`brand_slug`** у строки, если ответ пришёл без slug при том же **`brand_id`**. Подписки снимаются в cleanup через **`removeChannel`**. Отдельно канал **`incoming_calls`** — баннер входящего звонка.
- **Мастер заказа:** `src/components/pos/order-form.tsx` привязан к **`orderId`** и пропам **`wizardBrands`**, **`listOrder`**: шаги «Бренд» → «Оформление» (меню и корзина) → «Детали» (контакт, **`delivery_address` + отдельные поля адреса в БД**, доставка, оплата). Шаг «Бренд» рендерится из **`wizardBrands`** (лого и стили из **`BrandConfig`**, UUID бренда из **`dbId`** после загрузки каталога на **`/pos`**); **`brand_id`** для запросов меню берётся из **`dbId`** при наличии, иначе — запасной запрос к таблице **`brands`** по slug (**`resolveBrandId`**). Индикатор шагов в шапке — **три отдельные кнопки** (белый фон, без тени, без стрелок между шагами). После успешного **`updateOrderBrandPos`** вызывается **`syncBrandSlugOnOrdersPanel`**: **`refetchOrders`** панели и **`updateOrderLocalState`** с **`normalizePosBrandSlug`** (в т.ч. из **`persistBrandOrError`** при уходе со шага 1). В шапке: закрытие панели и меню **«⋯»** (Popover) — **«Очистить корзину»** (`replaceOrderItemsPos`, затем **`refreshCartFromDb`** и **`refetchOrders`**) и **«Закрыть заказ»** (диалог причины → **`cancelOrderPos`**, выход в **idle**). **`PopoverTrigger` с `asChild`** — **`src/components/ui/button.tsx`** и **`PosHeaderIconButton`** с **`forwardRef`**.
- **Prefetch заказа в мастере:** начальная загрузка заказа в **`useEffect`** зависит от **`orderId`** (строки **`order_items`** для корзины и поля заказа); объект **`form`** из React Hook Form **не** входит в массив зависимостей (во избежание повторной загрузки и сброса модалки товара при ререндере). Открытый заказ и **`step` (1–3)** задаются в **`OrderForm`** и не сбрасываются при **`refetchOrders`** на панели (при условии того же **`orderId`** и открытого мастера).
- **Кэш и переходы без лишней записи корзины:** при переходе со шага **2** на **1** или **3**, если отпечаток локальной корзины совпадает с последним состоянием после БД (**`cartFingerprint`** / **`lastSyncedCartFingerprintRef`** после prefetch или **`refreshCartFromDb`**), **`persistCartToServer`** (**`replaceOrderItemsPos`**) не вызывается — переход без задержки; иначе выполняется сохранение, затем смена шага. На шаге «Оформление» после успешной загрузки категорий для **`brand_id`** и позиций для пары **`brand_id` + category_id** повторные запросы при возврате на шаг 2 не выполняются (refs **`categoriesReadyBrandRef`**, **`menuLoadedKeyRef`**); при смене **`orderId`** мастера кэш сбрасывается.
- **Корзина в мастере (шаг «Оформление» и сводка на «Детали»):** **`PosCartItem`** (`src/types/pos.ts`) — опционально **`orderItemId`** для строк, уже сохранённых в БД. Изменения корзины **после успешного ответа** server action: **`addOrderItemsPos`**, **`updateOrderItemQuantityPos`** (в т.ч. объединение одинаковых позиций), **`removeOrderItemPos`** (в т.ч. «−» при qty 1), **`updateOrderItemCompositionPos`** (сохранение из модалки), **`replaceOrderItemsPos`** (очистка / уход со шага «Оформление»); затем **`refreshCartFromDb()`** и **`refetchOrders()`**. На время запроса интерфейс корзины блокируется; ошибки — **Sonner**. Принять/отклонить заказ с сайта — отдельные actions панели с **`reloadOrders`**.
- **`OrdersPanel` / смена статуса карточки:** **`handleStatusChange`** сначала пишет статус в Supabase, затем **`reloadOrders()`** (без предварительного локального патча списка).
- **Шаг «Детали»:** имя, телефон, адрес и структурные поля адреса при вводе сразу обновляют объект заказа в списке слева через **`updateOrderLocalState`**; **`updateOrderDetailsPos`** вызывается с **debounce 600 ms** после паузы во вводе. При обновлении **`listOrder`** с панели и **`!form.formState.isDirty`** выполняется **`form.reset`** из данных заказа списка (без отдельного запроса только ради полей формы). Переключатели **тип заказа (доставка / самовывоз)** и **способ оплаты** сохраняются **сразу** по клику. Кнопка **«Сохранить данные заказа»** — проверка Zod и немедленное сохранение (сброс debounce). Уведомления об ошибках сохранения — **Sonner**.
- Переход по индикатору шагов и кнопкам «Назад» / «К деталям» **не блокируется** валидацией формы шага 3. При уходе **со шага 2** на шаг **1** или **3** см. выше (**условный `persistCartToServer`** по отпечатку корзины); при необходимости сохранения — только после успеха переключается шаг. При уходе **со шага 1** в фоне вызывается **`persistBrandOrError`** (**`updateOrderBrandPos`** при необходимости), без ожидания навигации и без **`form.trigger`**.
- **Карточка заказа / детали:** `src/components/pos/order-detail.tsx` — загрузка и Realtime по заказу и строкам; при **`interactionMode="readonly"`** ( **`done`** и лист «Выданные» в Sheet) — только просмотр; иначе редактирование состава (минус при **qty 1** снимает строку). Вёрстка деталей: **`@container`** на области скролла — при узкой ширине (лист «Выданные» **`sm:max-w-md`**) одна колонка, **`InfoRow`** стопкой, блок позиций на всю ширину; при ширине контейнера **`≥640px`** прежняя сетка 5/12 + 7/12. Активный черновик в работе — в мастере **`OrderForm`**.
- Строки заказа: `src/lib/actions/pos/update-order-items.ts` — замена состава (**`replaceOrderItemsPos`** и др.), изменение количества, удаление строки допускает **очистить все позиции** заказа (в том числе последнюю через **`removeOrderItemPos`**), **`updateOrderItemCompositionPos`**; топпинги в модалке с учётом **`topping_groups.max_selections`**.
- Свайп-удаление строк в активной работе — `src/components/pos/swipe-to-delete.tsx`; модалка товара — `pos-product-modal.tsx`.

## Данные и БД

Основные таблицы:

- `brands` — slug, name и UUID бренда.
- `menu_categories` — в т.ч. **`is_condiment`** (категория соусов/приборов и т.п. для корзины и `/admin/condiments`).
- `menu_items` — в т.ч. **`is_default_condiment`** (автодобавление в корзине: васаби/имбирь/соус vs палочки), **`included_items`** (JSON-массив `{ name_ru, name_ro }[]` для блока «Входит в заказ» в модалке товара). Типы в `src/types/database.ts` могут отставать; админка кондиментов и часть клиентских запросов используют **`as any`** там, где колонки ещё не в сгенерированных типах.
- `topping_groups` (**`max_selections`** — лимит выбора из группы, `NULL` = без лимита), `toppings`, `menu_item_topping_groups`.
- `promotions`, `featured_menu_items`.
- `promo_codes`.
- `delivery_zones` — `polygon` JSONB как массив `[lat, lng]`, `color` (TEXT, HEX `#RRGGBB`, default) для отрисовки полигона, цена/минималка/время доставки.
- `orders`, `order_items` — в приложении поле **`user_birthday`** у заказов не используется (колонка в типах/селектах убрана).
- `incoming_calls` — события виртуальной АТС (webhook → upsert по `call_id`): для дисплея входящего в POS; схему и RLS/Realtime добавить в проекте при необходимости.
- `profiles`, `otp_codes` — storefront phone auth.
- `staff`, `shift_logs` — POS.

Правила:

- Контентные таблицы содержат `brand_id`; витрина и админка обязаны фильтровать по текущему бренду.
- Дочерние таблицы без `brand_id` фильтруются через родительские сущности.
- Денежные поля (`total`, `price`, `discount`, `delivery_fee`, `*_bani`) хранятся в банях.
- Записи, которые обходят RLS, выполняются через service role client в `src/lib/supabase/service-role.ts`.
- **Realtime Postgres Changes:** для подписки из клиента нужны включённые таблицы в публикации `supabase_realtime` и возможность клиента читать строки (или RLS будет скрывать события). Для списка заказов POS желательно разрешить чтение **`brands`** (минимум **`id`**, **`slug`**) для роли с тем же ключом, что и клиент POS — иначе join и запрос slug по id могут возвращать пусто. Для локальной истории см. файлы в `supabase/migrations/`; продакшен применять через Supabase MCP/CLI/dashboard согласно процессу команды.

## Миграции Supabase

- SQL для схемы хранится в `supabase/migrations/` и должен синхронизироваться с подключённым проектом.
- Типичные добавления: колонка `delivery_zones.color`; `topping_groups.max_selections`; **`menu_categories.is_condiment`**, **`menu_items.is_default_condiment`**, **`menu_items.included_items`**; публикация Realtime для `orders` и `order_items`; при использовании баннера входящего в POS — таблица **`incoming_calls`** и включение её в `supabase_realtime` (аналогично заказам).

## Server Actions и API

Server Actions в `src/lib/actions/`:

- `create-order.ts` — заказ с витрины; в **`order_items`** вставляются строки корзины и при наличии — **кондименты** (`condimentOrderLines`: `menu_item_id`, `item_name`, `quantity`, суммарная **`price`** в банях, `size: null`, `toppings: []`). После успешного сохранения (при наличии `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`) уходит уведомление в Telegram.
- `create-order-admin.ts` — заказ из админки.
- `validate-promo-code.ts`.
- `check-delivery-zone.ts`.
- `get-orders.ts`, `update-order-status.ts`.
- `get-brands.ts`, `set-admin-brand.ts`.
- `account/update-profile.ts`.
- `pos/*` — auth, shifts, черновик (`create-draft-order` / `createDraftOrderPos`), смена бренда черновика (`update-order-brand-pos`), принятие/отклонение заказа с сайта (`accept-order-pos`, `reject-order-pos`), отмена (`cancel-order-pos`), `update-order-details-pos`, `update-order-items` (замена позиций, количество, удаление, смена состава строки), zone check, при необходимости создание заказа из POS (`create-order-pos`) и др.

API routes:

| Route | Назначение |
|---|---|
| `POST /api/upload` | загрузка файлов в Supabase Storage |
| `POST /api/auth/send-otp` | отправка OTP через SMS.md |
| `POST /api/auth/verify-otp` | проверка OTP и cookie `storefront-session` |
| `GET /api/auth/me` | текущий storefront profile |
| `POST /api/auth/logout` | очистка storefront session |
| `POST /api/pbx-webhook` | webhook MoldCell PBX: проверка `crm_token` === `PBX_WEBHOOK_TOKEN`, разбор `application/x-www-form-urlencoded` или JSON, upsert в `incoming_calls` по `callid` / `call_id`, маппинг `diversion` → `brand_slug`; ответ `200` с телом `OK` |

Входящие звонки: поля событий ожидаются в соответствии с интеграцией PBX (в т.ч. `cmd`, `type`, `phone`, `diversion`). Клиент POS подписывается на **`incoming_calls`** только для UI-баннера; запись в таблицу делает сервер с **service role**.

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

PBX_WEBHOOK_TOKEN=
```

`POS_SESSION_SECRET` должен быть не короче 32 символов. `PBX_WEBHOOK_TOKEN` — общий секрет с телефонией (поле `crm_token` в теле webhook).

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

- Показать фактическую строку доставки в корзине вместо `-- лей / -- lei` (сумма уже учитывает кондименты в субтотале).
- Выровнять localStorage keys корзины/доставки с `BrandConfig.cartKey` / `deliveryKey`.
- При необходимости подтянуть подпись «Позвонить …» в `storefront.ts` под бренд или оставить динамику только в `aria-label` через `getBrandCallLabel`.
- Включить storefront phone auth UI и checkout guard после готовности UX.
- Расширить `validatePromoCode` для POS под выбранный в мастере бренд.
- Доработать gallery и lunch sets в админке.
