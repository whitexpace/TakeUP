-- Link accepted community request offers to the pending booking created from them.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "requestOfferId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_requestOfferId_key"
  ON "Booking"("requestOfferId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Booking_requestOfferId_fkey'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_requestOfferId_fkey"
      FOREIGN KEY ("requestOfferId") REFERENCES "RequestOffer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
