CREATE TABLE "RequestPost" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "itemNeeded" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "requestedFrom" TIMESTAMP(3) NOT NULL,
  "requestedTo" TIMESTAMP(3) NOT NULL,
  "minTargetPrice" INTEGER NOT NULL,
  "maxTargetPrice" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RequestPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestPost_requesterId_idx" ON "RequestPost"("requesterId");
CREATE INDEX "RequestPost_requestedTo_idx" ON "RequestPost"("requestedTo");
CREATE INDEX "RequestPost_createdAt_idx" ON "RequestPost"("createdAt");

ALTER TABLE "RequestPost"
  ADD CONSTRAINT "RequestPost_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
