-- AlterTable: Add audit_enabled to agents
ALTER TABLE "agents" ADD COLUMN "audit_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add call_buffer_seconds to lead_sources
ALTER TABLE "lead_sources" ADD COLUMN "call_buffer_seconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add call_duration_seconds to convoso_call_logs
ALTER TABLE "convoso_call_logs" ADD COLUMN "call_duration_seconds" INTEGER;
