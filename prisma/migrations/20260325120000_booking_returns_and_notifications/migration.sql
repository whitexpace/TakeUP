ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('BOOKING_RETURN_REQUESTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AppNotification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "bookingId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionPath" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppNotification_recipientUserId_readAt_createdAt_idx"
ON "AppNotification"("recipientUserId", "readAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AppNotification_bookingId_idx"
ON "AppNotification"("bookingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AppNotification_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "AppNotification"
    ADD CONSTRAINT "AppNotification_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AppNotification_actorUserId_fkey'
  ) THEN
    ALTER TABLE "AppNotification"
    ADD CONSTRAINT "AppNotification_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
