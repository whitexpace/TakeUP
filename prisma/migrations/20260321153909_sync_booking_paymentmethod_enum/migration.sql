-- Safe reconciliation migration.
-- The previous auto-generated SQL attempted a destructive reshape of transactions tables.
-- We intentionally keep this migration as a no-op to preserve existing production data.

SELECT 1;
