-- Migration: Replace SaleStatus enum (SUBMITTED/APPROVED/REJECTED/CANCELLED -> RAN/DECLINED/DEAD)
-- All existing sales migrate to RAN per user decision (all were working sales)

-- Step 1: Create new SaleStatus enum
CREATE TYPE "SaleStatus_new" AS ENUM ('RAN', 'DECLINED', 'DEAD');

-- Step 2: Alter sales.status column — map ALL existing values to RAN
ALTER TABLE "sales"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "sales"
  ALTER COLUMN "status" TYPE "SaleStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'RAN'::"SaleStatus_new"
      WHEN 'APPROVED'  THEN 'RAN'::"SaleStatus_new"
      WHEN 'REJECTED'  THEN 'RAN'::"SaleStatus_new"
      WHEN 'CANCELLED' THEN 'RAN'::"SaleStatus_new"
    END
  );

-- Step 3: Drop old enum, rename new to SaleStatus
DROP TYPE "SaleStatus";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";

-- Step 4: Set default to RAN
ALTER TABLE "sales"
  ALTER COLUMN "status" SET DEFAULT 'RAN'::"SaleStatus";

-- Step 5: Create ChangeRequestStatus enum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Step 6: Create status_change_requests table
CREATE TABLE "status_change_requests" (
  "id"           TEXT NOT NULL,
  "sale_id"      TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "oldStatus"    "SaleStatus" NOT NULL,
  "newStatus"    "SaleStatus" NOT NULL,
  "status"       "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by"  TEXT,
  "reviewed_at"  TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "status_change_requests_pkey" PRIMARY KEY ("id")
);

-- Step 7: Add foreign keys
ALTER TABLE "status_change_requests"
  ADD CONSTRAINT "status_change_requests_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "status_change_requests"
  ADD CONSTRAINT "status_change_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "status_change_requests"
  ADD CONSTRAINT "status_change_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 8: Add indexes for query performance
CREATE INDEX "status_change_requests_sale_id_idx" ON "status_change_requests"("sale_id");
CREATE INDEX "status_change_requests_status_idx" ON "status_change_requests"("status");
