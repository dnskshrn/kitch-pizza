ALTER TABLE orders
ADD COLUMN IF NOT EXISTS bonuses_earned integer NOT NULL DEFAULT 0;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles (id);
