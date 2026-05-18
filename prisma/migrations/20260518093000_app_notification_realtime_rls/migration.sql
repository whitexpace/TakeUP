ALTER TABLE public."AppNotification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notification recipients can read app notifications" ON public."AppNotification";
CREATE POLICY "Notification recipients can read app notifications"
  ON public."AppNotification"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."User" AS u
      WHERE u.id = "AppNotification"."recipientUserId"
        AND lower(u.email) = lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''))
        AND u.status = 'ACTIVE'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'AppNotification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."AppNotification";
  END IF;
END $$;
