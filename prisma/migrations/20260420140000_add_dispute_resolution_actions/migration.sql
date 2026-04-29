ALTER TYPE "dispute_status_enum" ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'BANNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLVED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeFinalDecision') THEN
    CREATE TYPE "DisputeFinalDecision" AS ENUM ('APPROVED', 'REJECTED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeActionType') THEN
    CREATE TYPE "DisputeActionType" AS ENUM ('WARNING', 'POINT_DEDUCTION', 'SUSPENSION', 'BAN');
  END IF;
END
$$;

ALTER TABLE "transaction_disputes"
  ADD COLUMN IF NOT EXISTS "final_decision" "DisputeFinalDecision",
  ADD COLUMN IF NOT EXISTS "final_decision_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "final_decided_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "final_decided_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "required_action_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'transaction_disputes_final_decided_by_user_id_fkey'
      AND table_name = 'transaction_disputes'
  ) THEN
    ALTER TABLE "transaction_disputes"
      ADD CONSTRAINT "transaction_disputes_final_decided_by_user_id_fkey"
      FOREIGN KEY ("final_decided_by_user_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "transaction_dispute_actions" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "dispute_id" TEXT NOT NULL,
  "type" "DisputeActionType" NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "points_delta" INTEGER,
  "note" TEXT,
  "applied_by_user_id" TEXT NOT NULL,
  "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transaction_dispute_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_dispute_actions_dispute_id_fkey"
    FOREIGN KEY ("dispute_id") REFERENCES "transaction_disputes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transaction_dispute_actions_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transaction_dispute_actions_applied_by_user_id_fkey"
    FOREIGN KEY ("applied_by_user_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_dispute_actions_dispute_applied"
  ON "transaction_dispute_actions" ("dispute_id", "applied_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_dispute_actions_target_applied"
  ON "transaction_dispute_actions" ("target_user_id", "applied_at" DESC);
