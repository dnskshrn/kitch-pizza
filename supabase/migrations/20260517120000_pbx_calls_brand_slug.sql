-- Линия бренда по diversion (ОАТС) для POS / Realtime
ALTER TABLE public.pbx_calls
  ADD COLUMN IF NOT EXISTS brand_slug text;
