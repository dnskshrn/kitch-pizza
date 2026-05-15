-- Сводка клиентов для админки (один SQL; вызывается через RPC service role).
CREATE OR REPLACE FUNCTION public.admin_customers_stats()
RETURNS TABLE (
  id uuid,
  phone text,
  name text,
  order_count bigint,
  ltv_bani bigint,
  bonus_balance bigint,
  first_order timestamptz,
  last_order timestamptz
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
    COUNT(o.id)::bigint AS order_count,
    COALESCE(SUM(o.total), 0)::bigint AS ltv_bani,
    COALESCE(
      (
        SELECT bt.balance_after::bigint
        FROM bonus_transactions bt
        WHERE bt.profile_id = p.id
        ORDER BY bt.created_at DESC
        LIMIT 1
      ),
      0::bigint
    ) AS bonus_balance,
    MIN(o.created_at) AS first_order,
    MAX(o.created_at) AS last_order
  FROM profiles p
  LEFT JOIN orders o ON o.profile_id = p.id AND o.status = 'done'
  GROUP BY p.id
  ORDER BY MAX(o.created_at) DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_customers_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customers_stats() TO service_role;
