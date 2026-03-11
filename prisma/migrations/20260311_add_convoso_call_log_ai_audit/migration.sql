-- AlterTable: make reviewer_user_id optional on call_audits
ALTER TABLE "call_audits" ALTER COLUMN "reviewer_user_id" DROP NOT NULL;

-- AlterTable: add AI audit fields to call_audits
ALTER TABLE "call_audits" ADD COLUMN "transcription" TEXT;
ALTER TABLE "call_audits" ADD COLUMN "ai_summary" TEXT;
ALTER TABLE "call_audits" ADD COLUMN "ai_score" INTEGER;
ALTER TABLE "call_audits" ADD COLUMN "ai_coaching_notes" TEXT;
ALTER TABLE "call_audits" ADD COLUMN "recording_url" TEXT;

-- CreateTable: convoso_call_logs
CREATE TABLE "convoso_call_logs" (
    "id" TEXT NOT NULL,
    "agent_user" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "recording_url" TEXT,
    "call_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent_id" TEXT,
    "lead_source_id" TEXT,
    "transcription" TEXT,
    "audit_status" TEXT NOT NULL DEFAULT 'pending',
    "call_audit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convoso_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convoso_call_logs_call_audit_id_key" ON "convoso_call_logs"("call_audit_id");

-- CreateIndex
CREATE INDEX "convoso_call_logs_call_timestamp_idx" ON "convoso_call_logs"("call_timestamp");

-- CreateIndex
CREATE INDEX "convoso_call_logs_agent_id_lead_source_id_call_timestamp_idx" ON "convoso_call_logs"("agent_id", "lead_source_id", "call_timestamp");

-- AddForeignKey
ALTER TABLE "convoso_call_logs" ADD CONSTRAINT "convoso_call_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convoso_call_logs" ADD CONSTRAINT "convoso_call_logs_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convoso_call_logs" ADD CONSTRAINT "convoso_call_logs_call_audit_id_fkey" FOREIGN KEY ("call_audit_id") REFERENCES "call_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
