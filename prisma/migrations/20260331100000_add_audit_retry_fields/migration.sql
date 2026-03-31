-- AlterTable
ALTER TABLE "convoso_call_logs" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_failed_at" TIMESTAMP(3),
ADD COLUMN "failure_reason" TEXT;
