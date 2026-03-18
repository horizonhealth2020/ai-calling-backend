-- CreateTable
CREATE TABLE "payroll_alerts" (
    "id" TEXT NOT NULL,
    "chargeback_submission_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "agent_name" TEXT,
    "customer_name" TEXT,
    "amount" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_period_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "cleared_by" TEXT,
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "call_log_id" TEXT,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: CsRepRoster add serviceAgentId FK
ALTER TABLE "cs_rep_roster" ADD COLUMN "service_agent_id" TEXT;

-- CreateIndex
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "permission_overrides_user_id_permission_key" ON "permission_overrides"("user_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "cs_rep_roster_service_agent_id_key" ON "cs_rep_roster"("service_agent_id");

-- AddForeignKey
ALTER TABLE "payroll_alerts" ADD CONSTRAINT "payroll_alerts_chargeback_submission_id_fkey" FOREIGN KEY ("chargeback_submission_id") REFERENCES "chargeback_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_alerts" ADD CONSTRAINT "payroll_alerts_approved_period_id_fkey" FOREIGN KEY ("approved_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_rep_roster" ADD CONSTRAINT "cs_rep_roster_service_agent_id_fkey" FOREIGN KEY ("service_agent_id") REFERENCES "service_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
