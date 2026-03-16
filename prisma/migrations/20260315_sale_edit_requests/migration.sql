CREATE TABLE "sale_edit_requests" (
  "id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changes" JSONB NOT NULL,
  "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_edit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_edit_requests_sale_id_idx" ON "sale_edit_requests"("sale_id");
CREATE INDEX "sale_edit_requests_status_idx" ON "sale_edit_requests"("status");

ALTER TABLE "sale_edit_requests" ADD CONSTRAINT "sale_edit_requests_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_edit_requests" ADD CONSTRAINT "sale_edit_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_edit_requests" ADD CONSTRAINT "sale_edit_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
