# Food Service / Kitch POS

Multi-brand платформа доставки еды: витрина, админка и POS в одном Next.js 14 приложении.

**Бренды:** [Kitch! Pizza](https://kitch.md) · [LOSOS](https://losos.md) · [The Spot](https://thespot.md)

Подробная документация по архитектуре, БД и бизнес-логике — в [`PROJECT.md`](./PROJECT.md).

## Стек

Next.js 14 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · Zustand

## Быстрый старт

```bash
npm install
npm run dev          # Turbopack, localhost:3000
# npm run dev:clean  # с очисткой .next
```

Нужен `.env.local` с ключами Supabase и прочими секретами (см. `PROJECT.md`).

### Локальные URL

| Зона | URL |
|---|---|
| Витрина (default) | http://localhost:3000 |
| LOSOS | http://localhost:3000/losos |
| The Spot | http://localhost:3000/thespot |
| POS | http://localhost:3000/pos |
| KDS | http://localhost:3000/pos/kds |
| Админка | http://localhost:3000/admin |

## Структура репозитория

```
src/
├── app/(client)/     # витрина, checkout
├── app/(admin)/admin # админка
├── app/pos/          # POS и KDS
├── brands/           # BrandConfig, домены, slug
├── components/       # UI, ReceiptTemplate, pos/, admin/
└── lib/              # actions, supabase, rawbt, receipt-print
```

## POS: печать предчека (Android + RawBT)

На Android-терминале с [RawBT](https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter):

- **Предчек** — кнопка «Печать предчека» в мастере заказа (шаг 2, корзина)
- Offscreen-шаблон `ReceiptTemplate` (576 px, brand-aware) → `html-to-image` → `rawbt:data:image/png;base64,...`
- **Денежный ящик** — меню **⋮** в шапке POS → «Открыть денежный ящик» (`rawbtSendBytes`, ESC p pin 01)

Ключевые файлы: `src/lib/receipt-print.ts`, `src/lib/rawbt.ts`, `src/components/ReceiptTemplate.tsx`.

## Скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Dev-сервер (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run setup:telegram` | Webhook Telegram-ботов |

## Деплой

Production — Vercel. Supabase project ID: `xioizekcyfmyxxklbvsd`.
