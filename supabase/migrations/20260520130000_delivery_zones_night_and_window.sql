-- Legacy zone fields (optional overrides; schedules in delivery_zone_schedules take precedence at runtime)
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS night_delivery_price_bani INTEGER,
  ADD COLUMN IF NOT EXISTS active_from TEXT,
  ADD COLUMN IF NOT EXISTS active_to TEXT;

COMMENT ON COLUMN delivery_zones.night_delivery_price_bani IS
  'Night delivery price in bani (23:00–05:59 Chisinau); NULL = use delivery_price_bani.';
COMMENT ON COLUMN delivery_zones.active_from IS
  'Zone availability window start (HH:MM, Europe/Chisinau); NULL with active_to = 24/7.';
COMMENT ON COLUMN delivery_zones.active_to IS
  'Zone availability window end (HH:MM, Europe/Chisinau); NULL with active_from = 24/7.';
