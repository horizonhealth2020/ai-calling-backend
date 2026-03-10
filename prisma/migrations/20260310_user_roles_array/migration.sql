-- Add roles array column, copy existing role value into it, then drop role column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" "UserRole"[] NOT NULL DEFAULT '{}';

-- Migrate existing single role into roles array
UPDATE "users" SET "roles" = ARRAY["role"::"UserRole"] WHERE "role" IS NOT NULL;

-- Drop the old single-role column
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
