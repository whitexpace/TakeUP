-- CreateTable
CREATE TABLE "CartEntry" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartEntry_borrowerId_itemId_startAt_endAt_key" ON "CartEntry"("borrowerId", "itemId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "CartEntry_borrowerId_createdAt_idx" ON "CartEntry"("borrowerId", "createdAt");

-- CreateIndex
CREATE INDEX "CartEntry_itemId_idx" ON "CartEntry"("itemId");

-- AddForeignKey
ALTER TABLE "CartEntry" ADD CONSTRAINT "CartEntry_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartEntry" ADD CONSTRAINT "CartEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
