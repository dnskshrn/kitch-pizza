-- Вложенная позиция в техкарте комбо: ссылка на другую позицию меню + её вариант.
-- Количество строки не участвует в списании (заглушка quantity = 1 для NOT NULL / CHECK).

ALTER TABLE public.product_recipes
  ADD COLUMN IF NOT EXISTS menu_item_ref_id uuid REFERENCES public.menu_items (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS menu_item_ref_variant_id uuid REFERENCES public.menu_item_variants (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_recipes.menu_item_ref_id IS 'Компонент комбо: ссылка на позицию меню; quantity строки не используется при списании (хранить 1).';
COMMENT ON COLUMN public.product_recipes.menu_item_ref_variant_id IS 'Вариант вложенной позиции; NULL — базовый рецепт без варианта.';

ALTER TABLE public.product_recipes
  DROP CONSTRAINT IF EXISTS product_recipes_menu_ref_rules;

ALTER TABLE public.product_recipes
  ADD CONSTRAINT product_recipes_menu_ref_rules CHECK (
    menu_item_ref_id IS NULL
    OR (
      quantity = 1
      AND ingredient_id IS NULL
      AND semi_finished_id IS NULL
    )
  );
