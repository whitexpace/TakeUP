-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_user_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_review_drafts" DROP CONSTRAINT "transaction_review_drafts_reviewer_user_id_fkey";

-- AlterTable
ALTER TABLE "transaction_review_drafts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_rewards" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "transaction_review_drafts" ADD CONSTRAINT "transaction_review_drafts_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "item_boosts_item_status_expires_idx" RENAME TO "item_boosts_item_id_status_expires_at_idx";

-- RenameIndex
ALTER INDEX "item_boosts_user_created_idx" RENAME TO "item_boosts_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "reward_events_item_boost_idx" RENAME TO "reward_events_item_boost_id_idx";

-- RenameIndex
ALTER INDEX "reward_events_review_idx" RENAME TO "reward_events_review_id_idx";

-- RenameIndex
ALTER INDEX "reward_events_transaction_status_idx" RENAME TO "reward_events_transaction_id_status_idx";

-- RenameIndex
ALTER INDEX "reward_events_user_created_idx" RENAME TO "reward_events_user_id_created_at_idx";
