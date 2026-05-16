-- POS Realtime по pbx_calls: подписки postgres_changes работают только при SELECT по RLS.

CREATE POLICY "pbx_calls_select_pos_realtime"
  ON public.pbx_calls
  FOR SELECT
  TO anon, authenticated
  USING (cmd IN ('contact', 'event'));

-- Имя клиента для UI: читать profiles только если есть contact-строка PBX с этим profile_id
CREATE POLICY "profiles_select_linked_pbx_contact"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pbx_calls pc
      WHERE pc.profile_id = profiles.id
        AND pc.cmd = 'contact'
    )
  );
