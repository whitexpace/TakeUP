CREATE TYPE "AdminItemModerationState" AS ENUM ('DEACTIVATED', 'REMOVED');

ALTER TABLE "Item"
ADD COLUMN "adminModerationState" "AdminItemModerationState",
ADD COLUMN "adminModeratedById" TEXT,
ADD COLUMN "adminModeratedAt" TIMESTAMPTZ(6);

ALTER TABLE "Item"
ADD CONSTRAINT "Item_adminModeratedById_fkey"
FOREIGN KEY ("adminModeratedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Item_adminModerationState_createdAt_idx"
ON "Item" ("adminModerationState", "createdAt" DESC);

CREATE INDEX "Item_adminModeratedById_idx"
ON "Item" ("adminModeratedById");

CREATE TABLE "admin_action_logs" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "admin_user_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "target_label" TEXT,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "item_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_action_logs"
ADD CONSTRAINT "admin_action_logs_admin_user_id_fkey"
FOREIGN KEY ("admin_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_action_logs"
ADD CONSTRAINT "admin_action_logs_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "admin_action_logs_admin_user_id_created_at_idx"
ON "admin_action_logs" ("admin_user_id", "created_at" DESC);

CREATE INDEX "admin_action_logs_target_type_created_at_idx"
ON "admin_action_logs" ("target_type", "created_at" DESC);

CREATE INDEX "admin_action_logs_target_type_target_id_created_at_idx"
ON "admin_action_logs" ("target_type", "target_id", "created_at" DESC);

CREATE INDEX "admin_action_logs_item_id_created_at_idx"
ON "admin_action_logs" ("item_id", "created_at" DESC);
