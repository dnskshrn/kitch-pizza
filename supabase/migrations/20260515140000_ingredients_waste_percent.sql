-- Потери при очистке: % для пересчёта брутто → нетто в техкартах (0 по умолчанию).
ALTER TABLE public.ingredients
ADD COLUMN IF NOT EXISTS waste_percent numeric(6, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ingredients.waste_percent IS 'Процент потерь при очистке (0–100): нетто = брутто × (1 − % / 100)';
