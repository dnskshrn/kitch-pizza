-- Фактически полученное количество (единицы хранения ингредиента); null = как quantity
alter table public.supply_order_items
  add column if not exists received_qty numeric;

comment on column public.supply_order_items.received_qty is
  'Фактически полученное количество; null означает то же, что quantity (заказано)';
