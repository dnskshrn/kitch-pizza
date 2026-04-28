ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS user_birthday date;
