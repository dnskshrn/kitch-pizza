-- Weight (grams) for menu items; applied via Supabase MCP as add_weight_to_menu_items
alter table public.menu_items
  add column if not exists weight_grams integer,
  add column if not exists size_s_weight integer,
  add column if not exists size_l_weight integer;

comment on column public.menu_items.weight_grams is 'Weight in grams for single-size items (has_sizes = false)';
comment on column public.menu_items.size_s_weight is 'Weight in grams for small size (30cm)';
comment on column public.menu_items.size_l_weight is 'Weight in grams for large size (33cm)';
