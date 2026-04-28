# Дизайн-система Food Service POS

> Источник истины для всех UI-решений в проекте.
> Любые отступления от этого документа — ошибка дизайна.

---

## Палитра

Всего **5 цветов**. Ничего лишнего.

| Имя | HEX | oklch | Роль |
|-----|-----|-------|------|
| White | `#ffffff` | `oklch(1 0 0)` | Поверхности: карточки, панели, шапка |
| Gray | `#f2f2f2` | `oklch(0.961 0 0)` | Фон приложения, разделители, инпуты, hover |
| Dark | `#242424` | `oklch(0.192 0 0)` | Основной текст, активные состояния, иконки |
| Mid | `#808080` | `oklch(0.533 0 0)` | Вторичный текст, метки, неактивные состояния |
| Lime | `#ccff00` | `oklch(0.931 0.253 122.7)` | **Единственный акцент** — только для CTA |

### Как использовать

```
White  →  bg-background / bg-card
Gray   →  bg-muted / bg-secondary / border / bg-accent (hover)
Dark   →  text-foreground / активный таб / активный пункт меню
Mid    →  text-muted-foreground / иконки / неактивный текст
Lime   →  bg-primary / только главная CTA-кнопка
```

### Чего нельзя делать

- ❌ Использовать другие цвета без явного обоснования
- ❌ Lime на что-либо кроме главной CTA-кнопки
- ❌ Текст белого цвета на сером фоне (плохой контраст)
- ❌ Цветные бейджи без необходимости — используй Dark/Mid

---

## Типографика

### Шрифты

| Шрифт | Переменная | Использование |
|-------|-----------|---------------|
| **Inter** | `--font-sans` / `font-sans` | Весь интерфейс — заголовки, текст, кнопки, метки |
| **Roboto Mono** | `--font-mono` / `font-mono` | Время, цены, номера заказов, коды |

### Веса — только два

| Вес | Число | Tailwind | Когда |
|-----|-------|---------|-------|
| **Regular** | 400 | `font-normal` | Описания, вторичный текст, метаданные |
| **Bold** | 700 | `font-bold` | Заголовки, названия, важные числа, кнопки |

> Никаких `font-medium`, `font-semibold`, `font-light` — только Regular и Bold.

### Шкала размеров

| Класс | px | Использование |
|-------|----|---------------|
| `text-[11px]` | 11px | Метки секций (uppercase), дистанция, подсказки |
| `text-xs` | 12px | Вторичный текст, номер заказа, время в карточке |
| `text-sm` | 14px | Основной текст интерфейса, описания |
| `text-base` | 16px | Названия, кнопки, важный контент |
| `text-lg` | 18px | Суммы, итого |
| `text-xl` | 20px | Крупные акценты |

### Специальные паттерны

```css
/* Метка секции */
font-family: Inter;
font-size: 11px;
font-weight: 400;
text-transform: uppercase;
letter-spacing: 0.08em;
color: #808080;

/* Логотип FOOD SERVICE */
font-family: Inter;
font-size: 13px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.06em;
line-height: 1.2;
color: #242424;

/* Цифровые часы */
font-family: Roboto Mono;
font-size: 15px;
font-weight: 400;
letter-spacing: 0.05em;
font-variant-numeric: tabular-nums;
color: #242424;

/* Цена / сумма */
font-family: Roboto Mono;
font-size: 13px;
font-weight: 700;
font-variant-numeric: tabular-nums;
color: #242424;

/* Вторичная цена ("от 89 лей") */
font-family: Inter;
font-size: 12px;
font-weight: 400;
color: #808080;

/* Номер заказа (#1) */
font-family: Roboto Mono;
font-size: 12px;
font-weight: 400;
color: #808080;
```

---

## Отступы

Базовая единица — **4px**. Все отступы кратны 4.

| px | Tailwind | Использование |
|----|---------|---------------|
| 4px | `p-1` | Минимальный (иконки в кнопках) |
| 8px | `p-2` | Плотные компоненты |
| 12px | `p-3` | Бейджи, теги, компактные элементы |
| 16px | `p-4` | Стандартный padding (карточки, строки) |
| 20px | `p-5` | Секции корзины |
| 24px | `p-6` | Шапка (px), крупные панели |

---

## Радиус

| px | Tailwind | Использование |
|----|---------|---------------|
| 4px | `rounded` | Мелкие внутренние элементы |
| 8px | `rounded-lg` | Карточки, инпуты, кнопки CTA |
| 12px | `rounded-xl` | Диалоги, модалки |
| 9999px | `rounded-full` | **Табы, бейджи, теги, кнопки-иконки, фото товаров** |

---

## Тени и поверхности

Интерфейс **плоский**. Слои разделяются цветом, а не тенями.

| Слой | Цвет | Элементы |
|------|------|---------|
| App BG | `#f2f2f2` | Центральная зона (меню, контент) |
| Surface | `#ffffff` | Панели, карточки, шапка |
| Overlay | `shadow-md` | Поповеры, дропдауны |
| Modal | `shadow-xl` | Диалоги |

```
Разделитель между панелями:  border-r / border-l в #f2f2f2
Разделитель между строками:  border-b в #f2f2f2
Никаких box-shadow на белых карточках
```

---

## Иконки

**Библиотека:** Lucide React

| Контекст | Размер |
|---------|--------|
| Inline в тексте | `size-3` (12px) |
| Метаданные (адрес, телефон) | `size-3.5` (14px) |
| Кнопки-иконки | `size-4` (16px) |
| Шапка | `size-[18px]` |

```
Основные:    color: #242424
Вторичные:   color: #808080
На Lime CTA: color: #242424
```

---

## Компоненты

### Кнопка — CTA (К оформлению)

```css
background: #ccff00;
color: #242424;
font-family: Inter;
font-size: 15px;
font-weight: 700;
border-radius: 8px;       /* rounded-lg — не pill */
padding: 14px 20px;
width: 100%;
display: flex;
align-items: center;
justify-content: space-between;

:hover  { background: #bbee00; }
:active { background: #aadd00; transform: scale(0.99); }
:disabled { background: #f2f2f2; color: #808080; }
```

### Кнопка — Ghost (обычные действия)

```css
background: transparent;
color: #242424;
font-size: 13px;
font-weight: 400;
border-radius: 9999px;
padding: 6px 12px;

:hover  { background: #f2f2f2; }
:active { background: #e8e8e8; }
```

### Таб — активный

```css
background: #242424;
color: #ffffff;
font-family: Inter;
font-size: 13px;
font-weight: 700;
border-radius: 9999px;
padding: 5px 16px;
```

### Таб — неактивный

```css
background: transparent;  /* или #f2f2f2 для категорий */
color: #808080;
font-family: Inter;
font-size: 13px;
font-weight: 400;
border-radius: 9999px;
padding: 5px 16px;

:hover { color: #242424; }
```

### Бейдж — статус заказа

```css
/* Базовый */
border-radius: 9999px;
padding: 2px 8px;
font-family: Inter;
font-size: 11px;
font-weight: 700;

/* Выдан */        background: #e5ff66; color: #3d5a00;
/* Новый */        background: #fff9e6; color: #b38600;
/* В работе */     background: #eff6ff; color: #1d4ed8;
/* Готовится */    background: #fff5eb; color: #c2410c;
/* Готов */        background: #e5ffe5; color: #15803d;
/* Отменён */      background: #fef2f2; color: #b91c1c;
```

> Статусные цвета — единственное исключение из основной палитры.
> Везде в остальном — только 5 базовых цветов.

### Тег / Pill (бренд, дистанция)

```css
background: #f2f2f2;
color: #808080;
font-size: 11px;
font-weight: 400;
border-radius: 9999px;
padding: 2px 8px;
```

### Кнопка-иконка

```css
width: 34px; height: 34px;
border-radius: 9999px;
background: transparent;
color: #808080;
display: flex; align-items: center; justify-content: center;

:hover  { background: #f2f2f2; color: #242424; }
:active { background: #e8e8e8; }
```

### Input / Search

```css
border: 1px solid #f2f2f2;
border-radius: 8px;
padding: 8px 12px;
font-family: Inter;
font-size: 14px;
font-weight: 400;
background: #ffffff;
color: #242424;

::placeholder { color: #808080; }
:focus { border-color: #242424; outline: none; }
```

### Счётчик количества (+/-)

```css
button {
  width: 24px; height: 24px;
  border: 1px solid #f2f2f2;
  border-radius: 9999px;
  font-size: 14px;
  color: #242424;
  background: transparent;

  :hover  { border-color: #242424; }
  :active { background: #f2f2f2; }
}

value {
  font-family: Roboto Mono;
  font-size: 13px;
  font-weight: 400;
  min-width: 16px;
  text-align: center;
  color: #242424;
}
```

---

## Layout POS

### Основной экран (список заказов / деталь / idle)

```
┌──────────────────────────────────────────────────────────────────────┐
│  APP HEADER  h-14  bg-[#f2f2f2] rounded-2xl                         │
│  [FOOD SERVICE]          12:08:44          [Оператор] [Выйти]        │
├──────────────────┬───────────────────────────────────────────────────┤
│ ОСТРОВ СЛЕВА     │ ОСТРОВ СПРАВА                                      │
│ col-span-3       │ col-span-9                                         │
│ rounded-xl       │ rounded-xl                                         │
│ bg-[#f2f2f2]     │ bg-[#f2f2f2]                                       │
│                  │                                                    │
│ [ЗАКАЗЫ]         │  idle: «Выберите заказ» + кнопка «+ Новый заказ» │
│ ──────────       │  detail: OrderDetail                               │
│ [Табы]           │  create: OrderForm (см. ниже)                      │
│                  │                                                    │
│ [Order Card]     │                                                    │
│ [Order Card]     │                                                    │
│ overflow-y       │                                                    │
└──────────────────┴───────────────────────────────────────────────────┘

gap-5 p-5 bg-white (страница)
Ширины: left=col-span-3 · right=col-span-9
```

### Мастер заказа (`OrderForm`) — шаги 2 и 3

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ШАПКА МАСТЕРА  h-14  прозрачная (bg острова виден сквозь)               │
│ [← Бренд]    1. Бренд → 2. Заказ → 3. Оформление    [✕ белая плашка]   │
├──────────────────────────────────────┬──────────────────────────────────┤
│ ОФОРМЛЕНИЕ ЗАКАЗА                    │ КОРЗИНА  2                        │
│ белая rounded-xl, flex-1             │ белая rounded-xl, w-300px         │
│ p-3 от серого острова                │ p-3 от серого острова (pl-0)      │
│                                      │                                   │
│ ОФОРМЛЕНИЕ ЗАКАЗА ← лейбл 11px up.  │ КОРЗИНА N ← лейбл 11px uppercase │
│                                      │                                   │
│ [Пицца][Закуски][…] ← pill           │ ○ 4 Сыра · L                     │
│   bg-[#f2f2f2], overflow-x-auto      │   Альфредо, 4вф              ×   │
│                                      │   − 1 +          149 лей         │
│ ○  ○  ○  ○  ← grid, rounded-full    │                                   │
│    фото товаров                      │ ○ 4 Сыра · L                     │
│ Mario   4 Сыра  Pepperoni            │   Альфредо, 4вф              ×   │
│ от 89   от 89   от 150               │   − 1 +          149 лей         │
│   +       +       +                  │                                   │
│                                      │ flex-1 overflow-y                 │
│ overflow-y-auto                      │ ──────────────────────────────    │
│                                      │ подытог          298 лей          │
│                                      │ [К оформлению              >]    │
│                                      │  bg-primary (#ccff00) rounded-lg  │
└──────────────────────────────────────┴──────────────────────────────────┘

Зазор между карточками: gap-3 (серый фон острова виден)
Ширины: центр=flex-1 · корзина=300px
```

### Правила мастера
- Шапка не имеет собственного `background` — серый фон родительского острова `#f2f2f2` виден через неё
- Кнопка `✕` — **белая плашка** (`bg-white`) на сером фоне (контраст)
- Обе панели содержимого — **`rounded-xl bg-white`** с отступами `p-3` от краёв острова
- Зазор `gap-3` между карточками — серый `#f2f2f2` острова виден между ними
- Фото товаров в сетке: **`rounded-full`** контейнер
- Фото в корзине: **`rounded-full`** миниатюра 36×36

---

## Применение в коде

### CSS-переменные (уже обновлено в globals.css)

```css
--background:         #ffffff  (oklch(1 0 0))
--foreground:         #242424  (oklch(0.192 0 0))
--primary:            #ccff00  (oklch(0.931 0.253 122.7))
--primary-foreground: #242424  (oklch(0.192 0 0))
--secondary:          #f2f2f2  (oklch(0.961 0 0))
--muted:              #f2f2f2
--muted-foreground:   #808080  (oklch(0.533 0 0))
--border:             #f2f2f2
--ring:               #ccff00
```

### Шрифты (уже обновлено в layout.tsx)

```tsx
// Inter — font-sans — весь UI
// Roboto Mono — font-mono — числа, время, цены
```

### Tailwind-утилиты для быстрого использования

```tsx
// Фон приложения
<div className="bg-muted" />                // #f2f2f2

// Поверхность (панель, карточка)
<div className="bg-background" />           // #ffffff

// Основной текст
<p className="text-foreground" />           // #242424

// Вторичный текст
<p className="text-muted-foreground" />     // #808080

// CTA-кнопка
<button className="bg-primary text-primary-foreground font-bold" />  // lime

// Активный таб
<div className="bg-foreground text-background rounded-full" />       // dark pill

// Числа / время
<span className="font-mono tabular" />
```

---

*Палитра: `#ffffff` · `#f2f2f2` · `#242424` · `#808080` · `#ccff00`*
*Шрифты: Inter (400/700) · Roboto Mono (400/700)*
*Последнее обновление: Апрель 2026 (мастер заказа POS — layout 3 модуля)*
