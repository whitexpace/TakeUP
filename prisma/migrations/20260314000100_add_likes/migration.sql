-- CreateTable
CREATE TABLE IF NOT EXISTS "Like" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_itemId_key" ON "Like"("userId", "itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Like_itemId_idx" ON "Like"("itemId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Like_userId_fkey'
  ) THEN
    ALTER TABLE "Like"
      ADD CONSTRAINT "Like_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Like_itemId_fkey'
  ) THEN
    ALTER TABLE "Like"
      ADD CONSTRAINT "Like_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
