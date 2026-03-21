-- CreateTable
CREATE TABLE "ItemImage" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("id")
);

-- Backfill thumbnail image as primary image
INSERT INTO "ItemImage" ("id", "itemId", "path", "isPrimary", "sortOrder")
SELECT
  gen_random_uuid()::text,
  i."id",
  i."thumbnailImage",
  true,
  0
FROM "Item" i
WHERE i."thumbnailImage" IS NOT NULL
  AND btrim(i."thumbnailImage") <> '';

-- Backfill photo gallery images, preserving original array order
INSERT INTO "ItemImage" ("id", "itemId", "path", "isPrimary", "sortOrder")
SELECT
  gen_random_uuid()::text,
  i."id",
  p."photo",
  false,
  p."idx" + CASE WHEN i."thumbnailImage" IS NOT NULL AND btrim(i."thumbnailImage") <> '' THEN 1 ELSE 0 END
FROM "Item" i
CROSS JOIN LATERAL unnest(COALESCE(i."photos", ARRAY[]::TEXT[])) WITH ORDINALITY AS p("photo", "idx")
WHERE btrim(p."photo") <> ''
  AND (i."thumbnailImage" IS NULL OR i."thumbnailImage" <> p."photo");

-- Ensure items with photos but without a thumbnail still have one primary image
WITH first_image_per_item AS (
  SELECT DISTINCT ON ("itemId")
    "id",
    "itemId"
  FROM "ItemImage"
  ORDER BY "itemId", "sortOrder" ASC, "createdAt" ASC
)
UPDATE "ItemImage" image
SET "isPrimary" = true
FROM first_image_per_item first
WHERE image."id" = first."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "ItemImage" existing_primary
    WHERE existing_primary."itemId" = image."itemId"
      AND existing_primary."isPrimary" = true
  );

-- CreateIndex
CREATE INDEX "ItemImage_itemId_idx" ON "ItemImage"("itemId");

-- CreateIndex
CREATE INDEX "ItemImage_itemId_sortOrder_idx" ON "ItemImage"("itemId", "sortOrder");

-- CreateIndex
CREATE INDEX "ItemImage_itemId_isPrimary_idx" ON "ItemImage"("itemId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ItemImage_itemId_path_key" ON "ItemImage"("itemId", "path");

-- Keep only one primary image per item
CREATE UNIQUE INDEX "ItemImage_itemId_primary_unique" ON "ItemImage"("itemId")
WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "ItemImage"
ADD CONSTRAINT "ItemImage_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy image columns after backfill
ALTER TABLE "Item"
DROP COLUMN "thumbnailImage",
DROP COLUMN "photos";
