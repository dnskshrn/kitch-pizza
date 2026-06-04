-- Разбивка скидок: subtotal / item_discount / promo_discount на заказе,
-- original_price / item_discount_pct на позициях.
-- orders.discount = item_discount + promo_discount (контракт приложения).

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS original_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_discount_pct numeric(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_items.original_price IS 'Цена позиции без скидки на товар, bani';
COMMENT ON COLUMN order_items.item_discount_pct IS 'Процент скидки на товар';
COMMENT ON COLUMN orders.subtotal IS 'Сумма товаров до всех скидок, bani';
COMMENT ON COLUMN orders.item_discount IS 'Скидка на товары (item_percent и др.), bani';
COMMENT ON COLUMN orders.promo_discount IS 'Скидка промокода / order-level, bani';

-- Backfill legacy rows: цены позиций без per-item скидки; вся скидка заказа → promo_discount.
UPDATE order_items
SET original_price = price
WHERE original_price = 0;

UPDATE orders o
SET
  subtotal = COALESCE((
    SELECT SUM(oi.price)::integer
    FROM order_items oi
    WHERE oi.order_id = o.id
  ), 0),
  promo_discount = o.discount,
  item_discount = 0
WHERE o.subtotal = 0;
