-- PBX (ОАТС) webhook: входящие вызовы и события для POS Realtime

CREATE TABLE public.pbx_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callid text,
  cmd text NOT NULL,
  event_type text,
  caller text,
  raw_body jsonb NOT NULL,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pbx_calls ENABLE ROW LEVEL SECURITY;

-- Политики не задаём: клиентский доступ закрыт; API и POS — через service role (обход RLS).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pbx_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_calls;
  END IF;
END $$;
