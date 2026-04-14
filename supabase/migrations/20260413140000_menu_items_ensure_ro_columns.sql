-- Румынские поля для позиций меню (если таблица создана без них)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_ro TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description_ro TEXT;
