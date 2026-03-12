-- Add Convoso webhook fields to sales table
ALTER TABLE "sales" ADD COLUMN "recording_url" TEXT;
ALTER TABLE "sales" ADD COLUMN "convoso_lead_id" TEXT;
ALTER TABLE "sales" ADD COLUMN "call_duration" INTEGER;
ALTER TABLE "sales" ADD COLUMN "call_date_time" TIMESTAMP(3);

-- Add deduction amount to service payroll entries
ALTER TABLE "service_payroll_entries" ADD COLUMN "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
