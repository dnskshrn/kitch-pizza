alter table public.supply_orders
  add column if not exists annulled_at timestamptz;

comment on column public.supply_orders.annulled_at is
  'When set, the supply is annulled: stock was reversed and the order stays in history.';
