CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,
  min_order_bani INTEGER,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT promo_codes_discount_type_check CHECK (discount_type IN ('percent', 'fixed')),
  CONSTRAINT promo_codes_discount_value_positive CHECK (discount_value > 0),
  CONSTRAINT promo_codes_percent_cap CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

COMMENT ON TABLE promo_codes IS 'Promotional discount codes; code stored uppercase in application layer.';
