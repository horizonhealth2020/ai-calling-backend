-- CreateIndex
CREATE INDEX "convoso_call_logs_leadSourceId_callTimestamp_idx" ON "convoso_call_logs"("leadSourceId", "callTimestamp");

-- CreateIndex
CREATE INDEX "sales_leadSourceId_createdAt_idx" ON "sales"("leadSourceId", "createdAt");
