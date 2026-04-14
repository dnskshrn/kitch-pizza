-- Run this in Supabase → SQL Editor (once), then refresh the schema / reload API.
-- Fixes: "Could not find the 'image_url_ro' column of 'promotions' in the schema cache"

ALTER TABLE promotions
  DROP COLUMN IF EXISTS title_ru,
  DROP COLUMN IF EXISTS title_ro,
  DROP COLUMN IF EXISTS description_ru,
  DROP COLUMN IF EXISTS description_ro;

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS image_url_ru TEXT,
  ADD COLUMN IF NOT EXISTS image_url_ro TEXT;

-- If the table still has a legacy single column `image_url`, copy it into both locales, then drop it:
-- UPDATE promotions
-- SET image_url_ru = COALESCE(image_url_ru, image_url),
--     image_url_ro = COALESCE(image_url_ro, image_url)
-- WHERE image_url IS NOT NULL;
-- ALTER TABLE promotions DROP COLUMN IF EXISTS image_url;
