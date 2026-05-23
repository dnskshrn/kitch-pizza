-- Атомарное обновление ingredient_stock (средневзвешенная avg_cost) + stock_ledger для поставки.

CREATE OR REPLACE FUNCTION public.apply_supply_order_stock_items(
  p_order_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_delta numeric;
  v_cost numeric;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Нет позиций для обновления склада';
  END IF;

  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      ingredient_id uuid,
      stock_qty numeric,
      price_per_unit numeric
    )
  LOOP
    v_delta := r.stock_qty;
    v_cost := r.price_per_unit;

    IF v_delta IS NULL OR v_delta <= 0 THEN
      RAISE EXCEPTION 'Количество должно быть больше нуля';
    END IF;
    IF v_cost IS NULL OR v_cost < 0 THEN
      RAISE EXCEPTION 'Цена не может быть отрицательной';
    END IF;

    INSERT INTO public.ingredient_stock (ingredient_id, quantity, avg_cost, updated_at)
    VALUES (r.ingredient_id, v_delta, v_cost, now())
    ON CONFLICT (ingredient_id) DO UPDATE SET
      avg_cost = CASE
        WHEN (ingredient_stock.quantity + EXCLUDED.quantity) > 0 THEN
          round(
            (
              ingredient_stock.quantity * COALESCE(ingredient_stock.avg_cost, 0)
              + EXCLUDED.quantity * v_cost
            )::numeric
            / (ingredient_stock.quantity + EXCLUDED.quantity)::numeric,
            4
          )
        ELSE v_cost
      END,
      quantity = ingredient_stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    INSERT INTO public.stock_ledger (
      ingredient_id,
      movement_type,
      reference_id,
      reference_type,
      quantity_delta,
      cost_per_unit,
      note
    ) VALUES (
      r.ingredient_id,
      'supply',
      p_order_id,
      'supply_order',
      v_delta,
      v_cost,
      NULL
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_supply_order_stock_items(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_supply_order_stock_items(uuid, jsonb) TO service_role;
