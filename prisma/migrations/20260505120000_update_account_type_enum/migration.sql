-- Update AccountType enum: change from (LENDER, BORROWER, ADMIN) to (ADMIN, USER)
-- Create new enum type
CREATE TYPE "AccountType_new" AS ENUM ('ADMIN', 'USER');

-- Migrate data from old enum to new enum (LENDER and BORROWER both become USER)
ALTER TABLE "User" ALTER COLUMN "accountType" TYPE "AccountType_new" USING (
  CASE
    WHEN "accountType"::text IN ('LENDER', 'BORROWER') THEN 'USER'::"AccountType_new"
    WHEN "accountType"::text = 'ADMIN' THEN 'ADMIN'::"AccountType_new"
  END
);

-- Drop old enum and rename new one
DROP TYPE "AccountType";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
