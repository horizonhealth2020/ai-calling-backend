-- Add bonus and fronted fields to payroll_entries
ALTER TABLE "payroll_entries" ADD COLUMN "bonus_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "payroll_entries" ADD COLUMN "fronted_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Create service_agents table
CREATE TABLE "service_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_pay" DECIMAL(12, 2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_agents_pkey" PRIMARY KEY ("id")
);

-- Create service_payroll_entries table
CREATE TABLE "service_payroll_entries" (
    "id" TEXT NOT NULL,
    "service_agent_id" TEXT NOT NULL,
    "payroll_period_id" TEXT NOT NULL,
    "base_pay" DECIMAL(12, 2) NOT NULL,
    "bonus_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "total_pay" DECIMAL(12, 2) NOT NULL,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_payroll_entries_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on service_payroll_entries
CREATE UNIQUE INDEX "service_payroll_entries_payroll_period_id_service_agent_id_key" ON "service_payroll_entries"("payroll_period_id", "service_agent_id");

-- Add foreign keys
ALTER TABLE "service_payroll_entries" ADD CONSTRAINT "service_payroll_entries_service_agent_id_fkey" FOREIGN KEY ("service_agent_id") REFERENCES "service_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_payroll_entries" ADD CONSTRAINT "service_payroll_entries_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
