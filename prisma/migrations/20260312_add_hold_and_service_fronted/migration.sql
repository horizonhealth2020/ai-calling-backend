-- AlterTable: Add hold_amount to payroll_entries
ALTER TABLE "payroll_entries" ADD COLUMN "hold_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable: Add fronted_amount to service_payroll_entries
ALTER TABLE "service_payroll_entries" ADD COLUMN "fronted_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
