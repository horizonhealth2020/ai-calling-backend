-- Phase 81: Chargeback Recovery Alert + Reversal
-- Additive migration on payroll_alerts: add `type` (default SUBMISSION for back-compat)
-- and `clawback_id` (nullable FK to clawbacks). Existing rows get type='SUBMISSION'.
--
-- Rollback:
--   ALTER TABLE "payroll_alerts" DROP CONSTRAINT "payroll_alerts_clawback_id_fkey";
--   ALTER TABLE "payroll_alerts" DROP COLUMN "clawback_id";
--   ALTER TABLE "payroll_alerts" DROP COLUMN "type";
-- Safe because both columns are nullable/defaulted; no reader references them pre-plan.

ALTER TABLE "payroll_alerts"
  ADD COLUMN "type" VARCHAR(24) NOT NULL DEFAULT 'SUBMISSION',
  ADD COLUMN "clawback_id" TEXT;

ALTER TABLE "payroll_alerts"
  ADD CONSTRAINT "payroll_alerts_clawback_id_fkey"
  FOREIGN KEY ("clawback_id") REFERENCES "clawbacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payroll_alerts_clawback_id_idx" ON "payroll_alerts"("clawback_id");
CREATE INDEX "payroll_alerts_type_status_idx" ON "payroll_alerts"("type", "status");
