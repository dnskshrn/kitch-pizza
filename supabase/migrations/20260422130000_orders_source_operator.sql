-- POS / мультибренд: источник заказа и оператор (идемпотентно)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website'
    CHECK (source IN ('website', 'pos'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS operator_id uuid;
