ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "reply_to_message_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_reply_to_message_id_fkey'
  ) THEN
    ALTER TABLE "messages"
    ADD CONSTRAINT "messages_reply_to_message_id_fkey"
    FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "messages_reply_to_message_id_idx"
ON "messages"("reply_to_message_id");
