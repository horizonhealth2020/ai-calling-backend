-- AlterTable
ALTER TABLE "payroll_periods" ADD COLUMN "carryover_executed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agent_period_adjustments" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "payroll_period_id" TEXT NOT NULL,
    "bonus_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fronted_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hold_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus_label" TEXT,
    "hold_label" TEXT,
    "bonus_from_carryover" BOOLEAN NOT NULL DEFAULT false,
    "hold_from_carryover" BOOLEAN NOT NULL DEFAULT false,
    "carryover_source_period_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_period_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_period_adjustments_agent_id_payroll_period_id_key" ON "agent_period_adjustments"("agent_id", "payroll_period_id");

-- AddForeignKey
ALTER TABLE "agent_period_adjustments" ADD CONSTRAINT "agent_period_adjustments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_period_adjustments" ADD CONSTRAINT "agent_period_adjustments_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: aggregate entry-level values to agent+period level
INSERT INTO agent_period_adjustments (id, agent_id, payroll_period_id, bonus_amount, fronted_amount, hold_amount, created_at, updated_at)
SELECT
  gen_random_uuid(),
  agent_id,
  payroll_period_id,
  SUM(bonus_amount),
  SUM(fronted_amount),
  SUM(COALESCE(hold_amount, 0)),
  NOW(),
  NOW()
FROM payroll_entries
WHERE bonus_amount > 0 OR fronted_amount > 0 OR COALESCE(hold_amount, 0) > 0
GROUP BY agent_id, payroll_period_id
ON CONFLICT (agent_id, payroll_period_id) DO UPDATE SET
  bonus_amount = EXCLUDED.bonus_amount,
  fronted_amount = EXCLUDED.fronted_amount,
  hold_amount = EXCLUDED.hold_amount;

-- Zero out entry-level fields after migration
UPDATE payroll_entries SET bonus_amount = 0, fronted_amount = 0, hold_amount = 0
WHERE bonus_amount > 0 OR fronted_amount > 0 OR COALESCE(hold_amount, 0) > 0;
