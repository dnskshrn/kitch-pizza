-- Пагинация списка клиентов + count + address в выдаче.
DROP FUNCTION IF EXISTS public.admin_customers_list(text);

CREATE OR REPLACE FUNCTION public.admin_customers_list(
  search_q text DEFAULT NULL,
  list_limit int DEFAULT 100,
  list_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  phone text,
  name text,
  address text,
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
    p.address,
    COUNT(DISTINCT o.id)::bigint AS order_count,
    COALESCE(SUM(o.total), 0)::bigint AS ltv,
    COALESCE(
      (
        SELECT bt.balance_after
        FROM bonus_transactions bt
        WHERE bt.profile_id = p.id
        ORDER BY bt.created_at DESC
        LIMIT 1
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
  GROUP BY p.id, p.phone, p.name, p.address
  ORDER BY ltv DESC NULLS LAST
  LIMIT GREATEST(list_limit, 0)
  OFFSET GREATEST(list_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.admin_customers_list_count(search_q text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM profiles p
  WHERE
    search_q IS NULL
    OR trim(search_q) = ''
    OR p.phone ILIKE '%' || search_q || '%';
$$;

REVOKE ALL ON FUNCTION public.admin_customers_list(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customers_list(text, int, int) TO service_role;

REVOKE ALL ON FUNCTION public.admin_customers_list_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customers_list_count(text) TO service_role;
