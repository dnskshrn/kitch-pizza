CREATE TABLE delivery_zone_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
  from_time TIME NOT NULL,
  to_time TIME NOT NULL,
  delivery_time_min INTEGER NOT NULL,
  delivery_price_bani INTEGER NOT NULL,
  min_order_bani INTEGER NOT NULL,
  free_delivery_from_bani INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT delivery_zone_schedules_from_to_check CHECK (from_time <> to_time)
);

CREATE INDEX delivery_zone_schedules_zone_id_idx
  ON delivery_zone_schedules (zone_id);

COMMENT ON TABLE delivery_zone_schedules IS
  'Time-based delivery params override per zone; empty list = zone base columns apply 24/7.';
