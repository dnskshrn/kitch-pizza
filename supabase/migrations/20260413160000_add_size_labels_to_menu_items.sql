-- Custom labels for S/L variants (pizza cm, nuggets pcs, etc.)
alter table public.menu_items
  add column if not exists size_s_label text,
  add column if not exists size_l_label text;

comment on column public.menu_items.size_s_label is 'Display label for small variant (e.g. 30cm, 6 pcs)';
comment on column public.menu_items.size_l_label is 'Display label for large variant (e.g. 33cm, 9 pcs)';
