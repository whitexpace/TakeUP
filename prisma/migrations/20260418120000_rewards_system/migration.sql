DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeOutcome') THEN
    CREATE TYPE "DisputeOutcome" AS ENUM (
      'BORROWER_AT_FAULT',
      'LENDER_AT_FAULT',
      'SHARED_FAULT',
      'DISMISSED',
      'NO_FAULT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RewardSourceType') THEN
    CREATE TYPE "RewardSourceType" AS ENUM (
      'TRANSACTION_COMPLETED',
      'REVIEW_SUBMITTED',
      'DISPUTE_RESOLUTION_ADJUSTMENT',
      'BOOST_REDEMPTION',
      'MANUAL_ADJUSTMENT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RewardRoleCategory') THEN
    CREATE TYPE "RewardRoleCategory" AS ENUM ('BORROWER', 'LENDER', 'GENERAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RewardEventStatus') THEN
    CREATE TYPE "RewardEventStatus" AS ENUM ('PENDING', 'APPLIED', 'REVERSED', 'BLOCKED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItemBoostType') THEN
    CREATE TYPE "ItemBoostType" AS ENUM ('STANDARD_24_HOUR');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItemBoostStatus') THEN
    CREATE TYPE "ItemBoostStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "boostScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "boostExpiresAt" TIMESTAMP(3);

ALTER TABLE "transaction_disputes"
  ADD COLUMN IF NOT EXISTS "outcome" "DisputeOutcome";

CREATE TABLE IF NOT EXISTS "user_rewards" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "available_points" INTEGER NOT NULL DEFAULT 0,
  "total_points_earned" INTEGER NOT NULL DEFAULT 0,
  "borrower_points" INTEGER NOT NULL DEFAULT 0,
  "lender_points" INTEGER NOT NULL DEFAULT 0,
  "pending_points" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_rewards_user_id_key" ON "user_rewards" ("user_id");
CREATE INDEX IF NOT EXISTS "user_rewards_available_points_idx" ON "user_rewards" ("available_points");
CREATE INDEX IF NOT EXISTS "user_rewards_borrower_points_idx" ON "user_rewards" ("borrower_points");
CREATE INDEX IF NOT EXISTS "user_rewards_lender_points_idx" ON "user_rewards" ("lender_points");

CREATE TABLE IF NOT EXISTS "item_boosts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "points_spent" INTEGER NOT NULL,
  "boost_type" "ItemBoostType" NOT NULL,
  "boost_score" INTEGER NOT NULL,
  "status" "ItemBoostStatus" NOT NULL DEFAULT 'ACTIVE',
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "item_boosts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_boosts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "item_boosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "item_boosts_item_status_expires_idx"
  ON "item_boosts" ("item_id", "status", "expires_at" DESC);
CREATE INDEX IF NOT EXISTS "item_boosts_user_created_idx"
  ON "item_boosts" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "reward_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "transaction_id" TEXT,
  "review_id" TEXT,
  "item_boost_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "source_type" "RewardSourceType" NOT NULL,
  "role_category" "RewardRoleCategory" NOT NULL DEFAULT 'GENERAL',
  "points_delta" INTEGER NOT NULL,
  "status" "RewardEventStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "applied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "reward_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reward_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reward_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "reward_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "transaction_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "reward_events_item_boost_id_fkey" FOREIGN KEY ("item_boost_id") REFERENCES "item_boosts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reward_events_idempotency_key_key" ON "reward_events" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "reward_events_user_created_idx"
  ON "reward_events" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "reward_events_transaction_status_idx"
  ON "reward_events" ("transaction_id", "status");
CREATE INDEX IF NOT EXISTS "reward_events_review_idx" ON "reward_events" ("review_id");
CREATE INDEX IF NOT EXISTS "reward_events_item_boost_idx" ON "reward_events" ("item_boost_id");

INSERT INTO "user_rewards" ("user_id", "available_points", "total_points_earned", "borrower_points", "lender_points", "pending_points")
SELECT
  u."id",
  COALESCE(u."points", 0),
  GREATEST(COALESCE(u."points", 0), 0),
  0,
  0,
  0
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "user_rewards" ur WHERE ur."user_id" = u."id"
);

INSERT INTO "reward_events" (
  "user_id",
  "idempotency_key",
  "source_type",
  "role_category",
  "points_delta",
  "status",
  "metadata",
  "applied_at"
)
SELECT
  ur."user_id",
  'legacy:reward-balance:' || ur."user_id",
  'MANUAL_ADJUSTMENT'::"RewardSourceType",
  'GENERAL'::"RewardRoleCategory",
  ur."available_points",
  'APPLIED'::"RewardEventStatus",
  jsonb_build_object('reason', 'legacy_balance_backfill'),
  now()
FROM "user_rewards" ur
WHERE ur."available_points" > 0
  AND ur."borrower_points" = 0
  AND ur."lender_points" = 0
  AND ur."pending_points" = 0
  AND NOT EXISTS (
    SELECT 1
    FROM "reward_events" re
    WHERE re."idempotency_key" = 'legacy:reward-balance:' || ur."user_id"
  );
