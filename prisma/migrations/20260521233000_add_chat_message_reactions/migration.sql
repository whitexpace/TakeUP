CREATE TABLE IF NOT EXISTS public.message_reactions (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  conversation_id text NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id text NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_conversation_id_created_at_idx
  ON public.message_reactions(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
  ON public.message_reactions(message_id);

CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx
  ON public.message_reactions(user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Chat participants can read message reactions" ON public.message_reactions;
CREATE POLICY "Chat participants can read message reactions"
  ON public.message_reactions
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
      WHERE c.id = message_reactions.conversation_id
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
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
