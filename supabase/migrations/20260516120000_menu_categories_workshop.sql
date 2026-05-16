-- Цех категории для KDS (в доменной модели: order_items → products → menu_categories.workshop;
-- в БД связь через menu_items.category_id → menu_categories)
ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS workshop text;

COMMENT ON COLUMN public.menu_categories.workshop IS 'Цех на KDS: operator | pizza | kebab | sushi; NULL — общее / без цеха';
