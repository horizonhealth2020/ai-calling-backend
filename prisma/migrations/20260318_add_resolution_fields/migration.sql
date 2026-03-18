-- AlterTable
ALTER TABLE "chargeback_submissions" ADD COLUMN "resolved_at" TIMESTAMP(3),
ADD COLUMN "resolved_by" TEXT,
ADD COLUMN "resolution_note" TEXT,
ADD COLUMN "resolution_type" TEXT;

-- AlterTable
ALTER TABLE "pending_terms" ADD COLUMN "resolved_at" TIMESTAMP(3),
ADD COLUMN "resolved_by" TEXT,
ADD COLUMN "resolution_note" TEXT,
ADD COLUMN "resolution_type" TEXT;

-- AddForeignKey
ALTER TABLE "chargeback_submissions" ADD CONSTRAINT "chargeback_submissions_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_terms" ADD CONSTRAINT "pending_terms_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
