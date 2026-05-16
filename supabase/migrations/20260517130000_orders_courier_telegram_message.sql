ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS courier_tg_chat_id text,
  ADD COLUMN IF NOT EXISTS courier_tg_message_id bigint,
  ADD COLUMN IF NOT EXISTS courier_tg_message_updated_at timestamptz;
