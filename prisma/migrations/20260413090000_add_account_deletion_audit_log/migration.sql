CREATE TABLE "account_deletion_audit_logs" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "deleted_user_id" TEXT NOT NULL,
  "deleted_user_email" TEXT,
  "deleted_username" TEXT,
  "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT "account_deletion_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_deletion_audit_logs_deleted_user_id_idx"
  ON "account_deletion_audit_logs" ("deleted_user_id");

CREATE INDEX "account_deletion_audit_logs_deleted_at_idx"
  ON "account_deletion_audit_logs" ("deleted_at" DESC);
