-- save_topping_with_recipes: persist toppings.aggregator_price_bani
DROP FUNCTION IF EXISTS public.save_topping_with_recipes(
  boolean,
  uuid,
  uuid,
  uuid,
  text,
  text,
  bigint,
  int,
  boolean,
  text,
  jsonb
);

CREATE OR REPLACE FUNCTION public.save_topping_with_recipes(
  p_is_create boolean,
  p_topping_id uuid,
  p_brand_id uuid,
  p_group_id uuid,
  p_name_ru text,
  p_name_ro text,
  p_price bigint,
  p_aggregator_price_bani bigint,
  p_sort_order int,
  p_is_active boolean,
  p_image_url text,
  p_recipe_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  el jsonb;
  v_ing uuid;
  v_sf uuid;
  v_q numeric;
  v_qg numeric;
BEGIN
  IF p_is_create THEN
    INSERT INTO public.toppings (
      brand_id,
      group_id,
      name_ru,
      name_ro,
      price,
      aggregator_price_bani,
      sort_order,
      is_active,
      image_url
    )
    VALUES (
      p_brand_id,
      p_group_id,
      p_name_ru,
      p_name_ro,
      p_price,
      p_aggregator_price_bani,
      p_sort_order,
      p_is_active,
      p_image_url
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.toppings
    SET
      group_id = p_group_id,
      name_ru = p_name_ru,
      name_ro = p_name_ro,
      price = p_price,
      aggregator_price_bani = p_aggregator_price_bani,
      sort_order = p_sort_order,
      is_active = p_is_active,
      image_url = p_image_url
    WHERE id = p_topping_id
      AND brand_id = p_brand_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'topping not found';
    END IF;
    v_id := p_topping_id;
  END IF;

  DELETE FROM public.topping_recipes WHERE topping_id = v_id;

  FOR el IN
    SELECT t.elem
    FROM jsonb_array_elements(COALESCE(p_recipe_lines, '[]'::jsonb)) AS t(elem)
  LOOP
    IF (el->>'ingredient_id') IS NOT NULL AND (el->>'ingredient_id') <> '' THEN
      v_ing := (el->>'ingredient_id')::uuid;
      v_sf := NULL;
    ELSIF (el->>'semi_finished_id') IS NOT NULL AND (el->>'semi_finished_id') <> '' THEN
      v_ing := NULL;
      v_sf := (el->>'semi_finished_id')::uuid;
    ELSE
      CONTINUE;
    END IF;

    v_q := (el->>'quantity')::numeric;
    IF v_q IS NULL OR v_q <= 0 THEN
      CONTINUE;
    END IF;

    IF el->'quantity_gross' IS NOT NULL
       AND jsonb_typeof(el->'quantity_gross') <> 'null'
       AND (el->>'quantity_gross') <> '' THEN
      v_qg := (el->>'quantity_gross')::numeric;
    ELSE
      v_qg := NULL;
    END IF;

    INSERT INTO public.topping_recipes (
      topping_id,
      ingredient_id,
      semi_finished_id,
      quantity,
      quantity_gross
    )
    VALUES (v_id, v_ing, v_sf, v_q, v_qg);
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_topping_with_recipes(
  boolean,
  uuid,
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  int,
  boolean,
  text,
  jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_topping_with_recipes(
  boolean,
  uuid,
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  int,
  boolean,
  text,
  jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_topping_with_recipes(
  boolean,
  uuid,
  uuid,
  uuid,
  text,
  text,
  bigint,
  bigint,
  int,
  boolean,
  text,
  jsonb
) TO service_role;
