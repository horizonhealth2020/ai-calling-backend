-- AlterEnum
-- Phase 47 (Plan 47-05): cross-period clawback statuses
-- Adds two new values to PayrollEntryStatus so chargebacks against sales in
-- LOCKED/FINALIZED periods insert a distinct negative entry in the oldest OPEN
-- period (CLAWBACK_CROSS_PERIOD), and in-period zero-outs get their own color
-- band (ZEROED_OUT_IN_PERIOD) for visual distinction from the legacy
-- CLAWBACK_APPLIED state.
ALTER TYPE "PayrollEntryStatus" ADD VALUE IF NOT EXISTS 'ZEROED_OUT_IN_PERIOD';
ALTER TYPE "PayrollEntryStatus" ADD VALUE IF NOT EXISTS 'CLAWBACK_CROSS_PERIOD';
