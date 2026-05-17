-- Комментарий только для кухни (POS → KDS), отдельно от публичного `comment`.
alter table public.orders
  add column if not exists kitchen_note text;
