-- CreateTable
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "transaction_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "conversation_id" TEXT NOT NULL,
  "sender_user_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_transaction_id_key" ON "conversations"("transaction_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_transaction_id_idx" ON "conversations"("transaction_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_conversation_id_is_read_idx" ON "messages"("conversation_id", "is_read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_sender_user_id_idx" ON "messages"("sender_user_id");
