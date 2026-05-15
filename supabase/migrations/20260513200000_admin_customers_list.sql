-- Список клиентов для админки (агрегация + опциональный поиск по телефону).
CREATE OR REPLACE FUNCTION public.admin_customers_list(search_q text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  phone text,
  name text,
  order_count bigint,
  ltv bigint,
  bonus_balance numeric,
  first_order_at timestamptz,
  last_order_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.phone,
    p.name,
    COUNT(DISTINCT o.id)::bigint AS order_count,
    COALESCE(SUM(o.total), 0)::bigint AS ltv,
    COALESCE(
      (
        SELECT SUM(bt.amount)
        FROM bonus_transactions bt
        WHERE bt.profile_id = p.id
      ),
      0
    ) AS bonus_balance,
    MIN(o.created_at) AS first_order_at,
    MAX(o.created_at) AS last_order_at
  FROM profiles p
  LEFT JOIN orders o ON o.profile_id = p.id AND o.status NOT IN ('cancelled', 'rejected')
  WHERE
    search_q IS NULL
    OR trim(search_q) = ''
    OR p.phone ILIKE '%' || search_q || '%'
  GROUP BY p.id, p.phone, p.name
  ORDER BY ltv DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_customers_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customers_list(text) TO service_role;
