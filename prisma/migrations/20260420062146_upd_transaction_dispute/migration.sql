/*
  Warnings:

  - You are about to drop the `wallet_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallets` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `reason` on the `transaction_disputes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_wallet_id_fkey";

-- DropForeignKey
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_user_id_fkey";

-- AlterTable
ALTER TABLE "transaction_disputes" DROP COLUMN "reason",
ADD COLUMN     "reason" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'under_review';

-- DropTable
DROP TABLE "wallet_transactions";

-- DropTable
DROP TABLE "wallets";

-- DropEnum
DROP TYPE "WalletStatus";

-- DropEnum
DROP TYPE "WalletTransactionDirection";

-- DropEnum
DROP TYPE "WalletTransactionMethod";

-- DropEnum
DROP TYPE "WalletTransactionStatus";

-- DropEnum
DROP TYPE "WalletTransactionType";

-- DropEnum
DROP TYPE "dispute_reason_enum";
