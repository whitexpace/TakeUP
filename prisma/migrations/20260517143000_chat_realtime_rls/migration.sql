ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat participants can read conversations" ON public.conversations;
CREATE POLICY "Chat participants can read conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions AS t
      JOIN public."User" AS u
        ON u.id = t.borrower_user_id
        OR u.id = t.lender_user_id
      WHERE t.id = conversations.transaction_id
        AND lower(u.email) = lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''))
        AND u.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Chat participants can read messages" ON public.messages;
CREATE POLICY "Chat participants can read messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations AS c
      JOIN public.transactions AS t
        ON t.id = c.transaction_id
      JOIN public."User" AS u
        ON u.id = t.borrower_user_id
        OR u.id = t.lender_user_id
      WHERE c.id = messages.conversation_id
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
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
