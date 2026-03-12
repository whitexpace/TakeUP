-- AlterTable: add rating column to Item
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: compute rating from existing engagement signals
-- Formula: min(5, (likeCount + bookingCount) / greatest(viewCount, 1) * 5)
UPDATE "Item"
SET "rating" = LEAST(5.0, (("likeCount" + "bookingCount")::float / GREATEST("viewCount", 1)) * 5.0);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Item_rating_idx" ON "Item"("rating");
