-- Reconcile manual drift already present in the live database without resetting data.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletStatus') THEN
    CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN
    CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'EARNING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionMethod') THEN
    CREATE TYPE "WalletTransactionMethod" AS ENUM ('PSEUDO', 'GCASH', 'BANK', 'MAYA', 'SYSTEM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionDirection') THEN
    CREATE TYPE "WalletTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionStatus') THEN
    CREATE TYPE "WalletTransactionStatus" AS ENUM ('SUCCESS', 'FAILED', 'REVERSED', 'PENDING');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "wallets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "wallet_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "method" "WalletTransactionMethod" NOT NULL,
  "direction" "WalletTransactionDirection" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance_before" DECIMAL(12,2) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "reference_code" TEXT NOT NULL,
  "related_entity_type" TEXT,
  "related_entity_id" TEXT,
  "status" "WalletTransactionStatus" NOT NULL DEFAULT 'SUCCESS',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transaction_disputes'
      AND column_name = 'reason'
      AND udt_name = 'dispute_reason_enum'
  ) THEN
    ALTER TABLE "transaction_disputes"
      ALTER COLUMN "reason" TYPE TEXT USING "reason"::text;
  END IF;
END $$;

ALTER TABLE "transaction_disputes"
  ALTER COLUMN "status" SET DEFAULT 'under_review';

ALTER TABLE "transaction_disputes"
  ADD COLUMN IF NOT EXISTS "rebuttal_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rebuttal_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "rebuttal_submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rebuttal_text" TEXT;

DROP TYPE IF EXISTS "dispute_reason_enum";

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_id_key"
  ON "wallets"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_reference_code_key"
  ON "wallet_transactions"("reference_code");

CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_idx"
  ON "wallet_transactions"("wallet_id");

CREATE INDEX IF NOT EXISTS "wallet_transactions_user_id_idx"
  ON "wallet_transactions"("user_id");

CREATE INDEX IF NOT EXISTS "wallet_transactions_reference_code_idx"
  ON "wallet_transactions"("reference_code");

CREATE INDEX IF NOT EXISTS "wallet_transactions_related_entity_type_related_entity_id_idx"
  ON "wallet_transactions"("related_entity_type", "related_entity_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallets_user_id_fkey'
  ) THEN
    ALTER TABLE "wallets"
      ADD CONSTRAINT "wallets_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_transactions_wallet_id_fkey'
  ) THEN
    ALTER TABLE "wallet_transactions"
      ADD CONSTRAINT "wallet_transactions_wallet_id_fkey"
      FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE "wallet_transactions"
      ADD CONSTRAINT "wallet_transactions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transaction_disputes_rebuttal_by_user_id_fkey'
  ) THEN
    ALTER TABLE "transaction_disputes"
      ADD CONSTRAINT "transaction_disputes_rebuttal_by_user_id_fkey"
      FOREIGN KEY ("rebuttal_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
