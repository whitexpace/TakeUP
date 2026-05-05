-- Update AccountType enum: change from (LENDER, BORROWER, ADMIN) to (ADMIN, USER)
-- First, update all existing LENDER and BORROWER values to USER
UPDATE "User" SET "accountType" = 'USER' WHERE "accountType" IN ('LENDER', 'BORROWER');

-- Drop the old enum and create the new one
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
CREATE TYPE "AccountType" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "User" ALTER COLUMN "accountType" TYPE "AccountType" USING "accountType"::text::"AccountType";
DROP TYPE "AccountType_old";
