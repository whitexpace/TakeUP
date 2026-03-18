-- Enable UUID generation fallback for new TEXT ids
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== Enums =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status_enum') THEN
    CREATE TYPE transaction_status_enum AS ENUM (
      'pending',
      'awaiting_lender_approval',
      'confirmed',
      'paid',
      'ongoing',
      'returned',
      'completed',
      'cancelled',
      'in_dispute',
      'appealed',
      'refunded',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
    CREATE TYPE payment_method_enum AS ENUM ('gcash', 'card', 'bank', 'wallet', 'cash');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
    CREATE TYPE payment_status_enum AS ENUM ('pending', 'processing', 'success', 'failed', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_role_enum') THEN
    CREATE TYPE actor_role_enum AS ENUM ('system', 'borrower', 'lender', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_reason_enum') THEN
    CREATE TYPE dispute_reason_enum AS ENUM ('late', 'damaged', 'lost');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status_enum') THEN
    CREATE TYPE dispute_status_enum AS ENUM ('open', 'under_review', 'resolved', 'rejected', 'appealed');
  END IF;
END $$;

-- ===== Core transactions table =====
-- Keep compatibility with existing app by extending in place if table already exists.
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text
);

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "booking_id" TEXT,
  ADD COLUMN IF NOT EXISTS "borrower_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "lender_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "item_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rental_start_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rental_end_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rental_fee" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platform_fee" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "late_fee" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "damage_fee" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_amount_v2" NUMERIC(12,2)
    GENERATED ALWAYS AS ("rental_fee" + "platform_fee" + "late_fee" + "damage_fee") STORED,
  ADD COLUMN IF NOT EXISTS "current_status" transaction_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add constraints only once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_booking_id_key'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT transactions_booking_id_key UNIQUE ("booking_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_rental_window_check'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_rental_window_check
      CHECK ("rental_start_at" IS NULL OR "rental_end_at" IS NULL OR "rental_end_at" > "rental_start_at");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_non_negative_fees_check'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_non_negative_fees_check
      CHECK (
        "rental_fee" >= 0
        AND "platform_fee" >= 0
        AND "late_fee" >= 0
        AND "damage_fee" >= 0
      );
  END IF;
END $$;

-- Foreign keys (compatible with existing models/tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_borrower_user_id_fkey'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_borrower_user_id_fkey
      FOREIGN KEY ("borrower_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_lender_user_id_fkey'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_lender_user_id_fkey
      FOREIGN KEY ("lender_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_item_id_fkey'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_item_id_fkey
      FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ===== Payments =====
CREATE TABLE IF NOT EXISTS "transaction_payments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "transaction_id" TEXT NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "payer_user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "payee_user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" NUMERIC(12,2) NOT NULL CHECK ("amount" > 0),
  "fee_amount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("fee_amount" >= 0),
  "method" payment_method_enum NOT NULL,
  "gateway_reference" VARCHAR(100),
  "status" payment_status_enum NOT NULL DEFAULT 'pending',
  "processed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_payments_gateway_reference_unique"
  ON "transaction_payments" ("gateway_reference")
  WHERE "gateway_reference" IS NOT NULL;

-- ===== Status logs =====
CREATE TABLE IF NOT EXISTS "transaction_status_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "transaction_id" TEXT NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "old_status" transaction_status_enum,
  "new_status" transaction_status_enum NOT NULL,
  "changed_by_user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "changed_by_role" actor_role_enum NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_status_logs_distinct_status_check
    CHECK ("old_status" IS NULL OR "old_status" <> "new_status"),
  CONSTRAINT transaction_status_logs_actor_check
    CHECK (
      ("changed_by_role" = 'system' AND "changed_by_user_id" IS NULL)
      OR ("changed_by_role" <> 'system' AND "changed_by_user_id" IS NOT NULL)
    )
);

-- ===== Disputes =====
CREATE TABLE IF NOT EXISTS "transaction_disputes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "transaction_id" TEXT NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "filed_by_user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" dispute_reason_enum NOT NULL,
  "description" TEXT,
  "claimed_amount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("claimed_amount" >= 0),
  "status" dispute_status_enum NOT NULL DEFAULT 'open',
  "admin_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "resolution" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Reviews =====
CREATE TABLE IF NOT EXISTS "transaction_reviews" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "transaction_id" TEXT NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "reviewer_user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewee_user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "item_id" TEXT REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "rating" SMALLINT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "review_text" TEXT,
  "is_anonymous" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_reviews_reviewer_not_reviewee_check
    CHECK ("reviewee_user_id" IS NULL OR "reviewer_user_id" <> "reviewee_user_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_reviews_transaction_reviewer_unique"
  ON "transaction_reviews" ("transaction_id", "reviewer_user_id");

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS "idx_transactions_status_created"
  ON "transactions" ("current_status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_transactions_lender_status"
  ON "transactions" ("lender_user_id", "current_status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_transactions_borrower_status"
  ON "transactions" ("borrower_user_id", "current_status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_payments_txn_status"
  ON "transaction_payments" ("transaction_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_status_logs_txn_created"
  ON "transaction_status_logs" ("transaction_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_disputes_txn_status"
  ON "transaction_disputes" ("transaction_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_reviews_reviewee_created"
  ON "transaction_reviews" ("reviewee_user_id", "created_at" DESC);

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION set_updated_at_v2()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_set_updated_at_v2 ON "transactions";
CREATE TRIGGER trg_transactions_set_updated_at_v2
BEFORE UPDATE ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_v2();

-- ===== Status transition policy =====
CREATE OR REPLACE FUNCTION is_valid_transaction_status_transition(
  p_old transaction_status_enum,
  p_new transaction_status_enum
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_old
    WHEN 'pending' THEN p_new IN ('awaiting_lender_approval', 'cancelled', 'failed')
    WHEN 'awaiting_lender_approval' THEN p_new IN ('confirmed', 'cancelled', 'failed')
    WHEN 'confirmed' THEN p_new IN ('paid', 'cancelled', 'failed')
    WHEN 'paid' THEN p_new IN ('ongoing', 'in_dispute', 'refunded', 'failed')
    WHEN 'ongoing' THEN p_new IN ('returned', 'in_dispute', 'failed')
    WHEN 'returned' THEN p_new IN ('completed', 'in_dispute')
    WHEN 'in_dispute' THEN p_new IN ('appealed', 'completed', 'cancelled', 'refunded', 'failed')
    WHEN 'appealed' THEN p_new IN ('in_dispute', 'completed', 'cancelled', 'refunded', 'failed')
    WHEN 'completed' THEN FALSE
    WHEN 'cancelled' THEN FALSE
    WHEN 'refunded' THEN FALSE
    WHEN 'failed' THEN FALSE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION trg_validate_transaction_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."current_status" IS DISTINCT FROM OLD."current_status" THEN
    IF NOT is_valid_transaction_status_transition(OLD."current_status", NEW."current_status") THEN
      RAISE EXCEPTION
        'Invalid transaction status transition: % -> % (transaction_id=%)',
        OLD."current_status", NEW."current_status", OLD."id"
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_validate_status_transition ON "transactions";
CREATE TRIGGER trg_transactions_validate_status_transition
BEFORE UPDATE OF "current_status" ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION trg_validate_transaction_status_transition();

-- ===== Atomic status setter + log writer =====
CREATE OR REPLACE FUNCTION set_transaction_status(
  p_transaction_id TEXT,
  p_new_status transaction_status_enum,
  p_changed_by_user_id TEXT,
  p_changed_by_role actor_role_enum,
  p_remarks TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status transaction_status_enum;
BEGIN
  SELECT "current_status"
  INTO v_old_status
  FROM "transactions"
  WHERE "id" = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF v_old_status = p_new_status THEN
    RAISE EXCEPTION 'No-op transition is not allowed: % -> %', v_old_status, p_new_status;
  END IF;

  UPDATE "transactions"
  SET "current_status" = p_new_status
  WHERE "id" = p_transaction_id;

  INSERT INTO "transaction_status_logs" (
    "transaction_id", "old_status", "new_status", "changed_by_user_id", "changed_by_role", "remarks"
  ) VALUES (
    p_transaction_id, v_old_status, p_new_status, p_changed_by_user_id, p_changed_by_role, p_remarks
  );
END;
$$;

-- ===== Auto-move transaction to in_dispute when dispute is opened =====
CREATE OR REPLACE FUNCTION trg_on_dispute_open_set_txn_in_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status transaction_status_enum;
BEGIN
  IF NEW."status" <> 'open' THEN
    RETURN NEW;
  END IF;

  SELECT "current_status"
  INTO v_current_status
  FROM "transactions"
  WHERE "id" = NEW."transaction_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', NEW."transaction_id";
  END IF;

  IF v_current_status IN ('completed', 'cancelled', 'refunded', 'failed', 'in_dispute') THEN
    RETURN NEW;
  END IF;

  PERFORM set_transaction_status(
    NEW."transaction_id",
    'in_dispute',
    NEW."filed_by_user_id",
    'borrower',
    'Auto-set by dispute #' || NEW."id" || ' opened'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_insert_set_txn_in_dispute ON "transaction_disputes";
CREATE TRIGGER trg_dispute_insert_set_txn_in_dispute
AFTER INSERT ON "transaction_disputes"
FOR EACH ROW
EXECUTE FUNCTION trg_on_dispute_open_set_txn_in_dispute();

DROP TRIGGER IF EXISTS trg_dispute_update_set_txn_in_dispute ON "transaction_disputes";
CREATE TRIGGER trg_dispute_update_set_txn_in_dispute
AFTER UPDATE OF "status" ON "transaction_disputes"
FOR EACH ROW
WHEN (OLD."status" IS DISTINCT FROM NEW."status")
EXECUTE FUNCTION trg_on_dispute_open_set_txn_in_dispute();
