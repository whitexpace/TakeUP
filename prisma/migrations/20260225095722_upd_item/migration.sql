/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Item` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[googleSub]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `condition` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `freeToBorrow` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lenderId` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentalFee` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `googleSub` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('ELECTRONICS', 'BOOKS', 'CLOTHING', 'TOOLS', 'HOME_APPLIANCES', 'SPORTS_OUTDOORS', 'MUSIC_AUDIO', 'TOYS_GAMES', 'FURNITURE', 'VEHICLES_ACCESSORIES', 'HEALTH_BEAUTY', 'SCHOOL_SUPPLIES', 'PET_SUPPLIES', 'OTHER');

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "createdAt",
DROP COLUMN "ownerId",
DROP COLUMN "title",
DROP COLUMN "updatedAt",
ADD COLUMN     "availabilityDates" TIMESTAMP(3)[],
ADD COLUMN     "borrowerId" TEXT,
ADD COLUMN     "category" "ItemCategory" NOT NULL,
ADD COLUMN     "condition" "ItemCondition" NOT NULL,
ADD COLUMN     "freeToBorrow" BOOLEAN NOT NULL,
ADD COLUMN     "lenderId" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "rentalFee" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Item_lenderId_idx" ON "Item"("lenderId");

-- CreateIndex
CREATE INDEX "Item_borrowerId_idx" ON "Item"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
