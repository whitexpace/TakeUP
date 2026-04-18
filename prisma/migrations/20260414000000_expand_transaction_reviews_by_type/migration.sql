DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ReviewType'
  ) THEN
    CREATE TYPE "ReviewType" AS ENUM ('ITEM_REVIEW', 'LENDER_REVIEW', 'BORROWER_REVIEW');
  END IF;
END $$;

ALTER TABLE "transaction_reviews"
ADD COLUMN IF NOT EXISTS "review_type" "ReviewType" NOT NULL DEFAULT 'ITEM_REVIEW';

ALTER TABLE "transaction_reviews"
ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "transaction_reviews"
SET "review_text" = ''
WHERE "review_text" IS NULL;

ALTER TABLE "transaction_reviews"
ALTER COLUMN "review_text" SET NOT NULL;

DROP INDEX IF EXISTS "transaction_reviews_transaction_reviewer_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_reviews_transaction_reviewer_type_unique"
ON "transaction_reviews" ("transaction_id", "reviewer_user_id", "review_type");
