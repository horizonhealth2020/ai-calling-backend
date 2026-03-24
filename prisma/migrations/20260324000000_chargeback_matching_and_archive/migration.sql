-- Chargeback matching fields
ALTER TABLE "chargeback_submissions" ADD COLUMN "matched_sale_id" TEXT;
ALTER TABLE "chargeback_submissions" ADD COLUMN "match_status" TEXT;
ALTER TABLE "chargeback_submissions" ADD CONSTRAINT "chargeback_submissions_matched_sale_id_fkey" FOREIGN KEY ("matched_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- call_audits_archive: identical columns, no FKs
CREATE TABLE "call_audits_archive" (
  "id" TEXT PRIMARY KEY,
  "agent_id" TEXT NOT NULL,
  "call_date" TIMESTAMPTZ NOT NULL,
  "score" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "coaching_notes" TEXT,
  "reviewer_user_id" TEXT,
  "transcription" TEXT,
  "ai_summary" TEXT,
  "ai_score" INTEGER,
  "ai_coaching_notes" TEXT,
  "recording_url" TEXT,
  "call_outcome" TEXT,
  "call_duration_estimate" TEXT,
  "issues" JSONB,
  "wins" JSONB,
  "missed_opportunities" JSONB,
  "suggested_coaching" JSONB,
  "manager_summary" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archive_batch_id" TEXT NOT NULL
);
CREATE INDEX "idx_call_audits_archive_batch" ON "call_audits_archive"("archive_batch_id");
CREATE INDEX "idx_call_audits_archive_date" ON "call_audits_archive"("created_at");

-- convoso_call_logs_archive: identical columns, no FKs
CREATE TABLE "convoso_call_logs_archive" (
  "id" TEXT PRIMARY KEY,
  "agent_user" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "recording_url" TEXT,
  "call_duration_seconds" INTEGER,
  "call_timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "agent_id" TEXT,
  "lead_source_id" TEXT,
  "transcription" TEXT,
  "audit_status" TEXT NOT NULL DEFAULT 'pending',
  "call_audit_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archive_batch_id" TEXT NOT NULL
);
CREATE INDEX "idx_convoso_archive_batch" ON "convoso_call_logs_archive"("archive_batch_id");
CREATE INDEX "idx_convoso_archive_date" ON "convoso_call_logs_archive"("created_at");

-- app_audit_log_archive: identical columns, no FKs
CREATE TABLE "app_audit_log_archive" (
  "id" TEXT PRIMARY KEY,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archive_batch_id" TEXT NOT NULL
);
CREATE INDEX "idx_audit_log_archive_batch" ON "app_audit_log_archive"("archive_batch_id");
CREATE INDEX "idx_audit_log_archive_date" ON "app_audit_log_archive"("created_at");
