CREATE TABLE "agent_call_kpis" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "lead_source_id" TEXT NOT NULL,
  "convoso_user_id" TEXT NOT NULL,
  "total_calls" INTEGER NOT NULL,
  "avg_call_length" DECIMAL(10,2) NOT NULL,
  "calls_by_tier" JSONB NOT NULL,
  "cost_per_sale" DECIMAL(10,2),
  "total_lead_cost" DECIMAL(10,2),
  "longest_call" INTEGER NOT NULL DEFAULT 0,
  "conversion_eligible" BOOLEAN NOT NULL DEFAULT false,
  "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_call_kpis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_call_kpis_agent_id_lead_source_id_snapshot_date_idx" ON "agent_call_kpis"("agent_id", "lead_source_id", "snapshot_date");
CREATE INDEX "agent_call_kpis_snapshot_date_idx" ON "agent_call_kpis"("snapshot_date");

ALTER TABLE "agent_call_kpis" ADD CONSTRAINT "agent_call_kpis_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_call_kpis" ADD CONSTRAINT "agent_call_kpis_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
