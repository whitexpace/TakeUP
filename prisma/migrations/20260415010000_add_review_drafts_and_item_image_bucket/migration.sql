CREATE TABLE IF NOT EXISTS "transaction_review_drafts" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "transaction_id" TEXT NOT NULL,
  "reviewer_user_id" TEXT NOT NULL,
  "review_type" "ReviewType" NOT NULL DEFAULT 'ITEM_REVIEW',
  "rating" SMALLINT NOT NULL DEFAULT 5,
  "review_text" TEXT NOT NULL DEFAULT '',
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transaction_review_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_review_drafts_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_review_drafts_reviewer_user_id_fkey"
    FOREIGN KEY ("reviewer_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_review_drafts_transaction_reviewer_type_unique"
ON "transaction_review_drafts" ("transaction_id", "reviewer_user_id", "review_type");

CREATE INDEX IF NOT EXISTS "idx_review_drafts_reviewer_updated"
ON "transaction_review_drafts" ("reviewer_user_id", "updated_at" DESC);

CREATE OR REPLACE FUNCTION set_transaction_review_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_review_drafts_set_updated_at ON "transaction_review_drafts";
CREATE TRIGGER trg_transaction_review_drafts_set_updated_at
BEFORE UPDATE ON "transaction_review_drafts"
FOR EACH ROW
EXECUTE FUNCTION set_transaction_review_drafts_updated_at();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('item-images', 'item-images', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload their own item images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] IN ('items', 'reviews', 'request-references')
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can update their own item images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] IN ('items', 'reviews', 'request-references')
    )
    WITH CHECK (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] IN ('items', 'reviews', 'request-references')
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete their own item images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] IN ('items', 'reviews', 'request-references')
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
