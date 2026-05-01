ALTER TABLE delivery_zones
ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#5F7600';

COMMENT ON COLUMN delivery_zones.color IS 'HEX color used to display the delivery zone polygon.';
