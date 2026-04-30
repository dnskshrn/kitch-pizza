CREATE TABLE featured_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT featured_menu_items_brand_menu_item_unique UNIQUE (brand_id, menu_item_id)
);

CREATE INDEX featured_menu_items_brand_sort_idx
  ON featured_menu_items (brand_id, sort_order, created_at);

ALTER TABLE featured_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_menu_items_public_select"
  ON featured_menu_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "featured_menu_items_authenticated_insert"
  ON featured_menu_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "featured_menu_items_authenticated_update"
  ON featured_menu_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "featured_menu_items_authenticated_delete"
  ON featured_menu_items
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE featured_menu_items IS 'Brand-scoped carousel of existing menu items for the storefront block.';
