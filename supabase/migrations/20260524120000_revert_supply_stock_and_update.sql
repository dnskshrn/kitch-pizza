-- Откат остатков по строкам поставки + опциональная note в apply.

DROP FUNCTION IF EXISTS public.apply_supply_order_stock_items(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.revert_supply_order_stock_items(
  p_order_id uuid,
  p_items jsonb,
  p_note text DEFAULT 'Редактирование поставки (откат)'
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
  v_current_qty numeric;
  v_current_cost numeric;
  v_next_qty numeric;
  v_next_cost numeric;
  v_stock_qty numeric;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Нет позиций для отката склада';
  END IF;

  -- Проверка достаточности остатков по ингредиентам (сумма строк).
  FOR r IN
    SELECT ingredient_id, SUM(stock_qty)::numeric AS need_qty
    FROM jsonb_to_recordset(p_items) AS x(
      ingredient_id uuid,
      stock_qty numeric,
      price_per_unit numeric
    )
    GROUP BY ingredient_id
  LOOP
    SELECT quantity INTO v_stock_qty
    FROM public.ingredient_stock
    WHERE ingredient_id = r.ingredient_id;

    IF v_stock_qty IS NULL THEN
      RAISE EXCEPTION 'Нет данных об остатке для одного из ингредиентов';
    END IF;

    IF v_stock_qty < r.need_qty THEN
      RAISE EXCEPTION 'Недостаточно остатка для редактирования: часть товара уже списана или использована';
    END IF;
  END LOOP;

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

    SELECT quantity, COALESCE(avg_cost, 0)
    INTO v_current_qty, v_current_cost
    FROM public.ingredient_stock
    WHERE ingredient_id = r.ingredient_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Нет данных об остатке для одного из ингредиентов';
    END IF;

    IF v_current_qty < v_delta THEN
      RAISE EXCEPTION 'Недостаточно остатка для редактирования: часть товара уже списана или использована';
    END IF;

    v_next_qty := v_current_qty - v_delta;

    IF v_next_qty > 0 THEN
      v_next_cost := round(
        (v_current_qty * v_current_cost - v_delta * v_cost)::numeric
        / v_next_qty::numeric,
        4
      );
    ELSE
      v_next_cost := v_current_cost;
    END IF;

    UPDATE public.ingredient_stock
    SET
      quantity = v_next_qty,
      avg_cost = v_next_cost,
      updated_at = now()
    WHERE ingredient_id = r.ingredient_id;

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
      'manual',
      p_order_id,
      'supply_order',
      -v_delta,
      v_cost,
      p_note
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_supply_order_stock_items(
  p_order_id uuid,
  p_items jsonb,
  p_note text DEFAULT NULL
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
      p_note
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.revert_supply_order_stock_items(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_supply_order_stock_items(uuid, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.apply_supply_order_stock_items(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_supply_order_stock_items(uuid, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_supply_order_stock_items(
  p_order_id uuid,
  p_revert_items jsonb,
  p_apply_items jsonb,
  p_revert_note text DEFAULT 'Редактирование поставки (откат)',
  p_apply_note text DEFAULT 'Редактирование поставки (применение)'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.revert_supply_order_stock_items(
    p_order_id,
    p_revert_items,
    p_revert_note
  );
  PERFORM public.apply_supply_order_stock_items(
    p_order_id,
    p_apply_items,
    p_apply_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_supply_order_stock_items(uuid, jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_supply_order_stock_items(uuid, jsonb, jsonb, text, text) TO service_role;
