-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'RENTED', 'DEACTIVATED', 'DELETED');

-- AlterTable
ALTER TABLE "Item"
ADD COLUMN "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE';

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");
