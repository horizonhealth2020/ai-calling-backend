-- AlterTable
ALTER TABLE "chargeback_submissions" ADD COLUMN "bypass_reason" TEXT;

-- AlterTable
ALTER TABLE "pending_terms" ADD COLUMN "bypass_reason" TEXT;
