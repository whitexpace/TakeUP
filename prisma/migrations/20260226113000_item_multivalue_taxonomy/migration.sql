-- CreateTable
CREATE TABLE "ItemCategoryOnItem" (
    "itemId" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCategoryOnItem_pkey" PRIMARY KEY ("itemId","category")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTagOnItem" (
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ItemTagOnItem_pkey" PRIMARY KEY ("itemId","tagId")
);

-- Backfill existing single-category values before dropping the column
INSERT INTO "ItemCategoryOnItem" ("itemId", "category")
SELECT "id", "category"
FROM "Item";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "ItemCategoryOnItem_category_idx" ON "ItemCategoryOnItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "ItemTagOnItem_tagId_idx" ON "ItemTagOnItem"("tagId");

-- AddForeignKey
ALTER TABLE "ItemCategoryOnItem" ADD CONSTRAINT "ItemCategoryOnItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTagOnItem" ADD CONSTRAINT "ItemTagOnItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTagOnItem" ADD CONSTRAINT "ItemTagOnItem_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
