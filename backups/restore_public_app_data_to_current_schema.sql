BEGIN;

-- The backup SQL still uses the pre-ItemImage Item shape.
ALTER TABLE public."Item" ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE public."Item" ADD COLUMN IF NOT EXISTS "thumbnailImage" TEXT;

TRUNCATE TABLE
  public."Like",
  public."ItemTagOnItem",
  public."ItemCategoryOnItem",
  public."ItemAvailability",
  public."ItemImage",
  public."Booking",
  public."Item",
  public."Borrower",
  public."Lender",
  public."Admin",
  public."Tag",
  public."User"
RESTART IDENTITY CASCADE;

\i /home/fedder/Downloads/CMSC129/takeUP/TakeUP/backups/supabase_public_app_data_20260320_224146.sql

-- Rebuild ItemImage rows from the legacy thumbnail/photos columns in the backup.
INSERT INTO public."ItemImage" ("id", "itemId", "path", "isPrimary", "sortOrder")
SELECT
  gen_random_uuid()::text,
  i."id",
  i."thumbnailImage",
  true,
  0
FROM public."Item" i
WHERE i."thumbnailImage" IS NOT NULL
  AND btrim(i."thumbnailImage") <> '';

INSERT INTO public."ItemImage" ("id", "itemId", "path", "isPrimary", "sortOrder")
SELECT
  gen_random_uuid()::text,
  i."id",
  p."photo",
  false,
  p."idx" + CASE WHEN i."thumbnailImage" IS NOT NULL AND btrim(i."thumbnailImage") <> '' THEN 1 ELSE 0 END
FROM public."Item" i
CROSS JOIN LATERAL unnest(COALESCE(i."photos", ARRAY[]::TEXT[])) WITH ORDINALITY AS p("photo", "idx")
WHERE btrim(p."photo") <> ''
  AND (i."thumbnailImage" IS NULL OR i."thumbnailImage" <> p."photo");

WITH first_image_per_item AS (
  SELECT DISTINCT ON ("itemId")
    "id",
    "itemId"
  FROM public."ItemImage"
  ORDER BY "itemId", "sortOrder" ASC, "createdAt" ASC
)
UPDATE public."ItemImage" image
SET "isPrimary" = true
FROM first_image_per_item first
WHERE image."id" = first."id"
  AND NOT EXISTS (
    SELECT 1
    FROM public."ItemImage" existing_primary
    WHERE existing_primary."itemId" = image."itemId"
      AND existing_primary."isPrimary" = true
  );

ALTER TABLE public."Item"
DROP COLUMN IF EXISTS "thumbnailImage",
DROP COLUMN IF EXISTS photos;

COMMIT;

SET search_path TO public;

\i /home/fedder/Downloads/CMSC129/takeUP/TakeUP/prisma/migrations/20260317120000_transactions_v2/migration.sql
\i /home/fedder/Downloads/CMSC129/takeUP/TakeUP/prisma/migrations/20260322052024_reconcile_schema_with_existing_migrations/migration.sql
