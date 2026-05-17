-- Add rebuttal_image_url to transaction_disputes
ALTER TABLE "transaction_disputes" ADD COLUMN IF NOT EXISTS "rebuttal_image_url" TEXT;

-- Add suspended_until to User for timed suspensions
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspended_until" TIMESTAMPTZ;
