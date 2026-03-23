-- CreateEnum
CREATE TYPE "ItemRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "numericId" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Lender" ADD COLUMN     "id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Borrower" ADD COLUMN     "id" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "ItemRequest" (
    "id" SERIAL NOT NULL,
    "borrowerID" INTEGER NOT NULL,
    "itemNeeded" TEXT NOT NULL,
    "requestedDates" TIMESTAMP(3)[],
    "priceRange" INTEGER[],
    "description" TEXT NOT NULL,
    "status" "ItemRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestOffer" (
    "id" SERIAL NOT NULL,
    "lenderID" INTEGER NOT NULL,
    "requestID" INTEGER NOT NULL,
    "itemID" INTEGER NOT NULL,
    "rentalFee" INTEGER NOT NULL,
    "availability" BOOLEAN NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "rentalTerms" TEXT,
    "status" "RequestOfferStatus" NOT NULL DEFAULT 'PENDING',
    "borrowerReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemRequest_borrowerID_idx" ON "ItemRequest"("borrowerID");

-- CreateIndex
CREATE INDEX "ItemRequest_status_idx" ON "ItemRequest"("status");

-- CreateIndex
CREATE INDEX "ItemRequest_createdAt_idx" ON "ItemRequest"("createdAt");

-- CreateIndex
CREATE INDEX "RequestOffer_requestID_idx" ON "RequestOffer"("requestID");

-- CreateIndex
CREATE INDEX "RequestOffer_lenderID_idx" ON "RequestOffer"("lenderID");

-- CreateIndex
CREATE INDEX "RequestOffer_itemID_idx" ON "RequestOffer"("itemID");

-- CreateIndex
CREATE INDEX "RequestOffer_status_idx" ON "RequestOffer"("status");

-- CreateIndex
CREATE INDEX "RequestOffer_borrowerReadAt_idx" ON "RequestOffer"("borrowerReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestOffer_lenderID_requestID_key" ON "RequestOffer"("lenderID", "requestID");

-- CreateIndex
CREATE UNIQUE INDEX "Item_numericId_key" ON "Item"("numericId");

-- CreateIndex
CREATE INDEX "Item_numericId_idx" ON "Item"("numericId");

-- CreateIndex
CREATE UNIQUE INDEX "Lender_id_key" ON "Lender"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Borrower_id_key" ON "Borrower"("id");

-- AddForeignKey
ALTER TABLE "ItemRequest" ADD CONSTRAINT "ItemRequest_borrowerID_fkey" FOREIGN KEY ("borrowerID") REFERENCES "Borrower"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestOffer" ADD CONSTRAINT "RequestOffer_itemID_fkey" FOREIGN KEY ("itemID") REFERENCES "Item"("numericId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestOffer" ADD CONSTRAINT "RequestOffer_lenderID_fkey" FOREIGN KEY ("lenderID") REFERENCES "Lender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestOffer" ADD CONSTRAINT "RequestOffer_requestID_fkey" FOREIGN KEY ("requestID") REFERENCES "ItemRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
