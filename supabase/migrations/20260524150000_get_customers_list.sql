-- Колонки Poster (если ещё не добавлены)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS poster_orders_count int,
  ADD COLUMN IF NOT EXISTS poster_last_order_at timestamptz;

CREATE OR REPLACE FUNCTION get_customers_list(
  p_limit      int     DEFAULT 50,
  p_offset     int     DEFAULT 0,
  p_search     text    DEFAULT NULL,
  p_sort_by    text    DEFAULT 'created_at',   -- 'created_at'|'last_order'|'total_spend'|'orders_count'
  p_sort_dir   text    DEFAULT 'desc',
  p_min_orders int     DEFAULT 0,
  p_has_bonus  bool    DEFAULT NULL,
  p_reg_from   timestamptz DEFAULT NULL,
  p_reg_to     timestamptz DEFAULT NULL,
  p_active_days int   DEFAULT NULL             -- активен за последние N дней
)
RETURNS TABLE (
  id              uuid,
  phone           text,
  name            text,
  created_at      timestamptz,
  -- агрегаты с сайта
  site_orders_count   bigint,
  site_total_spend    bigint,   -- bani
  site_last_order_at  timestamptz,
  -- исторические данные Poster
  poster_orders_count int,
  poster_last_order_at timestamptz,
  -- итого
  total_orders_count  bigint,   -- site + poster
  last_order_at       timestamptz, -- GREATEST(site_last_order_at, poster_last_order_at)
  -- бонусы
  bonus_balance   int,
  -- пагинация
  total_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  order_stats AS (
    SELECT
      o.profile_id,
      COUNT(*)                    AS site_orders_count,
      SUM(o.total)                AS site_total_spend,
      MAX(o.created_at)           AS site_last_order_at
    FROM orders o
    WHERE o.status = 'done'
      AND o.profile_id IS NOT NULL
    GROUP BY o.profile_id
  ),
  bonus_stats AS (
    SELECT DISTINCT ON (bt.profile_id)
      bt.profile_id,
      bt.balance_after AS bonus_balance
    FROM bonus_transactions bt
    ORDER BY bt.profile_id, bt.created_at DESC
  ),
  base AS (
    SELECT
      p.id,
      p.phone,
      p.name,
      p.created_at,
      COALESCE(os.site_orders_count, 0)       AS site_orders_count,
      COALESCE(os.site_total_spend, 0)        AS site_total_spend,
      os.site_last_order_at,
      p.poster_orders_count,
      p.poster_last_order_at,
      (COALESCE(os.site_orders_count, 0) + COALESCE(p.poster_orders_count, 0)) AS total_orders_count,
      GREATEST(os.site_last_order_at, p.poster_last_order_at) AS last_order_at,
      COALESCE(bs.bonus_balance, 0)           AS bonus_balance
    FROM profiles p
    LEFT JOIN order_stats os ON os.profile_id = p.id
    LEFT JOIN bonus_stats bs ON bs.profile_id = p.id
    WHERE
      (p_search IS NULL OR trim(p_search) = '' OR p.phone ILIKE '%' || p_search || '%' OR p.name ILIKE '%' || p_search || '%')
      AND (p_reg_from IS NULL OR p.created_at >= p_reg_from)
      AND (p_reg_to   IS NULL OR p.created_at <= p_reg_to)
      AND (p_has_bonus IS NULL OR (p_has_bonus = true  AND COALESCE(bs.bonus_balance, 0) > 0)
                               OR (p_has_bonus = false AND COALESCE(bs.bonus_balance, 0) = 0))
      AND (p_active_days IS NULL OR GREATEST(os.site_last_order_at, p.poster_last_order_at) >= NOW() - (p_active_days || ' days')::interval)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE total_orders_count >= p_min_orders
  ),
  counted AS (SELECT COUNT(*) AS total_count FROM filtered)
  SELECT
    f.id, f.phone, f.name, f.created_at,
    f.site_orders_count, f.site_total_spend, f.site_last_order_at,
    f.poster_orders_count, f.poster_last_order_at,
    f.total_orders_count, f.last_order_at, f.bonus_balance,
    c.total_count
  FROM filtered f, counted c
  ORDER BY
    CASE WHEN p_sort_by = 'last_order'    AND p_sort_dir = 'desc' THEN f.last_order_at         END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_order'    AND p_sort_dir = 'asc'  THEN f.last_order_at         END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'total_spend'   AND p_sort_dir = 'desc' THEN f.site_total_spend      END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'total_spend'   AND p_sort_dir = 'asc'  THEN f.site_total_spend      END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'orders_count'  AND p_sort_dir = 'desc' THEN f.total_orders_count    END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'orders_count'  AND p_sort_dir = 'asc'  THEN f.total_orders_count    END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'created_at'    AND p_sort_dir = 'desc' THEN f.created_at            END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'created_at'    AND p_sort_dir = 'asc'  THEN f.created_at            END ASC  NULLS LAST,
    f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION public.get_customers_list(int, int, text, text, text, int, bool, timestamptz, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customers_list(int, int, text, text, text, int, bool, timestamptz, timestamptz, int) TO service_role;
