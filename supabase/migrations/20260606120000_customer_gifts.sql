CREATE TABLE IF NOT EXISTS public.customer_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items (id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'given', 'cancelled')),
  source_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  source_feedback_id uuid REFERENCES public.order_feedback (id) ON DELETE SET NULL,
  fulfilled_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  fulfilled_by text,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_reason text
);

CREATE INDEX IF NOT EXISTS idx_customer_gifts_profile_brand_status
  ON public.customer_gifts (profile_id, brand_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_gifts_pending
  ON public.customer_gifts (status)
  WHERE status = 'pending';
