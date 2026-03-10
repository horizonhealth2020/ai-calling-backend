-- Add extension to agents table
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "extension" TEXT;
