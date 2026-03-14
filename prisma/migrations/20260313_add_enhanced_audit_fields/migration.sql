-- AlterTable
ALTER TABLE "call_audits" ADD COLUMN "call_outcome" TEXT;
ALTER TABLE "call_audits" ADD COLUMN "call_duration_estimate" TEXT;
ALTER TABLE "call_audits" ADD COLUMN "issues" JSONB;
ALTER TABLE "call_audits" ADD COLUMN "wins" JSONB;
ALTER TABLE "call_audits" ADD COLUMN "missed_opportunities" JSONB;
ALTER TABLE "call_audits" ADD COLUMN "suggested_coaching" JSONB;
ALTER TABLE "call_audits" ADD COLUMN "manager_summary" TEXT;
