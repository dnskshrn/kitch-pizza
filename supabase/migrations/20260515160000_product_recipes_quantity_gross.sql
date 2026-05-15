-- Брутто по строке техкарты (ингредиент): списание со склада; нетто остаётся в quantity.
ALTER TABLE public.product_recipes
  ADD COLUMN IF NOT EXISTS quantity_gross double precision;

COMMENT ON COLUMN public.product_recipes.quantity_gross IS 'Брутто в ед. хранения (г/мл/шт). Списание со склада. NULL — как quantity для старых строк.';

UPDATE public.product_recipes
SET quantity_gross = quantity::double precision
WHERE quantity_gross IS NULL
  AND ingredient_id IS NOT NULL;
