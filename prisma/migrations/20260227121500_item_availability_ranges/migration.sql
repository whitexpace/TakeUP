-- CreateEnum
CREATE TYPE "ItemAvailabilityStatus" AS ENUM ('AVAILABLE', 'RENTED');

-- CreateTable
CREATE TABLE "ItemAvailability" (
    "itemId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ItemAvailabilityStatus" NOT NULL,

    CONSTRAINT "ItemAvailability_pkey" PRIMARY KEY ("itemId","startDate","endDate")
);

-- Backfill existing date-array values as one-day AVAILABLE ranges
INSERT INTO "ItemAvailability" ("itemId", "startDate", "endDate", "status")
SELECT DISTINCT
    i."id" AS "itemId",
    date_trunc('day', d."dateValue") AS "startDate",
    date_trunc('day', d."dateValue") + INTERVAL '1 day' AS "endDate",
    'AVAILABLE'::"ItemAvailabilityStatus" AS "status"
FROM "Item" i
CROSS JOIN LATERAL unnest(COALESCE(i."availabilityDates", ARRAY[]::TIMESTAMP(3)[])) AS d("dateValue");

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "availabilityDates";

-- CreateIndex
CREATE INDEX "ItemAvailability_itemId_status_idx" ON "ItemAvailability"("itemId", "status");

-- CreateIndex
CREATE INDEX "ItemAvailability_startDate_endDate_idx" ON "ItemAvailability"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "ItemAvailability" ADD CONSTRAINT "ItemAvailability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
