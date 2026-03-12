-- Add bonus_breakdown JSON column to service_payroll_entries
ALTER TABLE "service_payroll_entries" ADD COLUMN "bonus_breakdown" JSONB;
