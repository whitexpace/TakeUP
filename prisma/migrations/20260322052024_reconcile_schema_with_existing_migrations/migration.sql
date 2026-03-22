-- DropForeignKey
ALTER TABLE "transaction_disputes" DROP CONSTRAINT "transaction_disputes_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_payments" DROP CONSTRAINT "transaction_payments_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_reviews" DROP CONSTRAINT "transaction_reviews_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_status_logs" DROP CONSTRAINT "transaction_status_logs_transaction_id_fkey";

-- AddForeignKey
ALTER TABLE "transaction_disputes" ADD CONSTRAINT "transaction_disputes_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_payments" ADD CONSTRAINT "transaction_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_reviews" ADD CONSTRAINT "transaction_reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_status_logs" ADD CONSTRAINT "transaction_status_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
