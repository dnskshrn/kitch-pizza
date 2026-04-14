-- Колонки заказа, статусы, индексы (идемпотентно)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'delivery' CHECK (delivery_mode IN ('delivery', 'pickup')),
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
  ADD COLUMN IF NOT EXISTS change_from integer,
  ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'in_progress', 'delivering', 'done', 'cancelled'));

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_phone_idx ON orders(user_phone);
