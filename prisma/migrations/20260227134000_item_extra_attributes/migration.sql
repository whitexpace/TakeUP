-- CreateEnum
CREATE TYPE "RateOption" AS ENUM ('PER_HOUR', 'PER_DAY');

-- AlterTable
ALTER TABLE "Item"
ADD COLUMN "rateOption" "RateOption" NOT NULL DEFAULT 'PER_DAY',
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "replacementCost" INTEGER,
ADD COLUMN "whatItemOffers" TEXT,
ADD COLUMN "whatIsIncluded" TEXT,
ADD COLUMN "knownIssues" TEXT,
ADD COLUMN "usageLimitations" TEXT,
ADD COLUMN "thumbnailImage" TEXT,
ADD COLUMN "isTrending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bookingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Item_rateOption_idx" ON "Item"("rateOption");

-- CreateIndex
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");

-- CreateIndex
CREATE INDEX "Item_isTrending_idx" ON "Item"("isTrending");
