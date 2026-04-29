-- CreateEnum
CREATE TYPE "WalletScope" AS ENUM ('USER', 'SYSTEM');

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COMMISSION';

-- AlterTable
ALTER TABLE "wallets"
  ADD COLUMN "scope" "WalletScope" NOT NULL DEFAULT 'USER',
  ADD COLUMN "system_key" TEXT,
  ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "wallet_transactions"
  ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_system_key_key" ON "wallets"("system_key");

-- CreateIndex
CREATE INDEX "wallets_scope_idx" ON "wallets"("scope");
