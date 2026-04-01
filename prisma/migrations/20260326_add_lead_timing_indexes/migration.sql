-- CreateIndex (fixed: use DB column names, not Prisma field names)
CREATE INDEX IF NOT EXISTS "convoso_call_logs_lead_source_id_call_timestamp_idx" ON "convoso_call_logs"("lead_source_id", "call_timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_lead_source_id_created_at_idx" ON "sales"("lead_source_id", "created_at");
