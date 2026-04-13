-- CreateTable
CREATE TABLE "contact_attempts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "attempt_number" INTEGER NOT NULL,
    "chargeback_submission_id" TEXT,
    "pending_term_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attempts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_chargeback_submission_id_fkey" FOREIGN KEY ("chargeback_submission_id") REFERENCES "chargeback_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_pending_term_id_fkey" FOREIGN KEY ("pending_term_id") REFERENCES "pending_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
