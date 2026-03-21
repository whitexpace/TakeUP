-- Reconstructed migration to match already-applied DB migration:
-- 20260320154929_added_bookings_model

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM (
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
      'COMPLETED',
      'IN_DISPUTE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingPaymentStatus') THEN
    CREATE TYPE "BookingPaymentStatus" AS ENUM (
      'NOT_REQUIRED',
      'PENDING',
      'PAID',
      'FAILED',
      'REFUNDED'
    );
  END IF;
END $$;

-- Booking table
CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "borrowerId" TEXT NOT NULL,
  "lenderId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "disputeOpenedAt" TIMESTAMP(3),
  "paymentProcessedAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "paymentMethod" payment_method_enum NOT NULL,
  "platformCommission" INTEGER NOT NULL DEFAULT 0,
  "totalFee" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- Booking indexes
CREATE INDEX IF NOT EXISTS "Booking_borrowerId_idx" ON "Booking"("borrowerId");
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");
CREATE INDEX IF NOT EXISTS "Booking_itemId_idx" ON "Booking"("itemId");
CREATE INDEX IF NOT EXISTS "Booking_itemId_startDate_endDate_idx" ON "Booking"("itemId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "Booking_lenderId_idx" ON "Booking"("lenderId");
CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");

-- Booking foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_itemId_fkey') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_borrowerId_fkey') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_borrowerId_fkey"
      FOREIGN KEY ("borrowerId") REFERENCES "Borrower"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_lenderId_fkey') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_lenderId_fkey"
      FOREIGN KEY ("lenderId") REFERENCES "Lender"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ItemAvailability: switch from composite PK to id PK
ALTER TABLE "ItemAvailability" ADD COLUMN IF NOT EXISTS "id" TEXT;

UPDATE "ItemAvailability"
SET "id" = gen_random_uuid()::text
WHERE "id" IS NULL;

ALTER TABLE "ItemAvailability" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "ItemAvailability" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'ItemAvailability'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'ItemAvailability_pkey'
  ) THEN
    ALTER TABLE "ItemAvailability" DROP CONSTRAINT "ItemAvailability_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'ItemAvailability'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'ItemAvailability_pkey'
  ) THEN
    ALTER TABLE "ItemAvailability" ADD CONSTRAINT "ItemAvailability_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ItemAvailability_itemId_idx" ON "ItemAvailability"("itemId");
CREATE UNIQUE INDEX IF NOT EXISTS "ItemAvailability_itemId_startDate_endDate_key"
  ON "ItemAvailability"("itemId", "startDate", "endDate");
