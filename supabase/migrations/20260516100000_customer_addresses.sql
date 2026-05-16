-- Адреса клиентов (профиль витрины / POS) + legacy-поле profiles.address

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  label text,
  address text NOT NULL,
  entrance text,
  floor text,
  apartment text,
  intercom text,
  delivery_lat numeric,
  delivery_lng numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_profile_id
  ON public.customer_addresses (profile_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Клиент в Supabase Auth: id должен совпадать с profiles.id, иначе политика не откроет строки.
CREATE POLICY "customer_addresses_select_own"
  ON public.customer_addresses
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "customer_addresses_insert_own"
  ON public.customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "customer_addresses_update_own"
  ON public.customer_addresses
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "customer_addresses_delete_own"
  ON public.customer_addresses
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());
