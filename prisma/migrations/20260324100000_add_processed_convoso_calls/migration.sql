-- CreateTable
CREATE TABLE "processed_convoso_calls" (
    "id" TEXT NOT NULL,
    "convoso_call_id" TEXT NOT NULL,
    "lead_source_id" TEXT,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_convoso_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_convoso_calls_convoso_call_id_key" ON "processed_convoso_calls"("convoso_call_id");

-- CreateIndex
CREATE INDEX "processed_convoso_calls_processed_at_idx" ON "processed_convoso_calls"("processed_at");
