-- Default quantity applied when adding condiments to cart (admin condiments UX).
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS condiment_default_qty integer NOT NULL DEFAULT 0
    CHECK (condiment_default_qty >= 0 AND condiment_default_qty <= 10);

COMMENT ON COLUMN public.menu_items.condiment_default_qty IS
  'Suggested cart quantity on first add (condiments admin); clamped 0–10.';
