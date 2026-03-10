-- Add user_id to agents table
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- Add list_id to lead_sources table
ALTER TABLE "lead_sources" ADD COLUMN IF NOT EXISTS "list_id" TEXT;
