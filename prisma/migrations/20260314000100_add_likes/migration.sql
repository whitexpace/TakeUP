CREATE TABLE "Like" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Like_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Like_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Like_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Like_userId_itemId_key" ON "Like"("userId", "itemId");
CREATE INDEX "Like_userId_idx" ON "Like"("userId");
CREATE INDEX "Like_itemId_idx" ON "Like"("itemId");
