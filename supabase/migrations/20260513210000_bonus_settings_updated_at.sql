ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.bonus_settings
SET updated_at = coalesce(updated_at, now())
WHERE id = 1;
