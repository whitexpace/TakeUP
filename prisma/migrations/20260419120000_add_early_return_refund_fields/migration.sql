-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('NOT_RETURNED', 'RETURNED', 'EARLY_RETURNED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSED', 'NOT_ELIGIBLE', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('EARLY_RETURN');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "actualReturnedAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundProcessedAt" TIMESTAMP(3),
ADD COLUMN     "refundReason" "RefundReason",
ADD COLUMN     "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "returnStatus" "ReturnStatus" NOT NULL DEFAULT 'NOT_RETURNED';

-- CreateIndex
CREATE INDEX "Booking_returnStatus_idx" ON "Booking"("returnStatus");

-- CreateIndex
CREATE INDEX "Booking_refundStatus_idx" ON "Booking"("refundStatus");
