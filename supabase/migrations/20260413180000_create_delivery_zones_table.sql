CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  polygon JSONB NOT NULL,
  delivery_price_bani INTEGER NOT NULL,
  min_order_bani INTEGER NOT NULL,
  free_delivery_from_bani INTEGER,
  delivery_time_min INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN delivery_zones.polygon IS 'Array of [lat, lng] pairs as JSON.';
