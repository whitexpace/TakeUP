-- DropIndex
DROP INDEX "Item_createdAt_idx";

-- DropIndex
DROP INDEX "Item_isTrending_idx";

-- DropIndex
DROP INDEX "Item_rateOption_idx";

-- DropIndex
DROP INDEX "Item_rating_idx";

-- DropIndex
DROP INDEX "Item_status_idx";

-- AlterTable
ALTER TABLE "ItemAvailability" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

