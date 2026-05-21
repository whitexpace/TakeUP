CREATE TABLE "item_request_replies" (
  "id" TEXT NOT NULL,
  "request_id" INTEGER NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "parent_reply_id" TEXT,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_request_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_request_reply_upvotes" (
  "id" TEXT NOT NULL,
  "reply_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_request_reply_upvotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_request_reply_upvotes_reply_id_user_id_key"
  ON "item_request_reply_upvotes"("reply_id", "user_id");

CREATE INDEX "item_request_replies_request_id_created_at_idx"
  ON "item_request_replies"("request_id", "created_at" DESC);

CREATE INDEX "item_request_replies_parent_reply_id_created_at_idx"
  ON "item_request_replies"("parent_reply_id", "created_at" DESC);

CREATE INDEX "item_request_replies_author_user_id_created_at_idx"
  ON "item_request_replies"("author_user_id", "created_at" DESC);

CREATE INDEX "item_request_reply_upvotes_user_id_created_at_idx"
  ON "item_request_reply_upvotes"("user_id", "created_at" DESC);

CREATE INDEX "item_request_reply_upvotes_reply_id_created_at_idx"
  ON "item_request_reply_upvotes"("reply_id", "created_at" DESC);

ALTER TABLE "item_request_replies"
  ADD CONSTRAINT "item_request_replies_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "ItemRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_request_replies"
  ADD CONSTRAINT "item_request_replies_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_request_replies"
  ADD CONSTRAINT "item_request_replies_parent_reply_id_fkey"
  FOREIGN KEY ("parent_reply_id") REFERENCES "item_request_replies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_request_reply_upvotes"
  ADD CONSTRAINT "item_request_reply_upvotes_reply_id_fkey"
  FOREIGN KEY ("reply_id") REFERENCES "item_request_replies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_request_reply_upvotes"
  ADD CONSTRAINT "item_request_reply_upvotes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
