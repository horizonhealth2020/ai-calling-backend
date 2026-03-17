-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER_SERVICE';

-- CreateTable
CREATE TABLE "chargeback_submissions" (
    "id" TEXT NOT NULL,
    "posted_date" TIMESTAMP(3),
    "type" TEXT,
    "payee_id" TEXT,
    "payee_name" TEXT,
    "payout_percent" DECIMAL(5,2),
    "chargeback_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2),
    "transaction_description" TEXT,
    "product" TEXT,
    "member_company" TEXT,
    "member_id" TEXT,
    "member_agent_company" TEXT,
    "member_agent_id" TEXT,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batch_id" TEXT NOT NULL,
    "raw_paste" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargeback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_terms" (
    "id" TEXT NOT NULL,
    "agent_name" TEXT,
    "agent_id_field" TEXT,
    "member_id" TEXT,
    "member_name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "product" TEXT,
    "enroll_amount" DECIMAL(12,2),
    "monthly_amount" DECIMAL(12,2),
    "paid" TEXT,
    "created_date" TIMESTAMP(3),
    "first_billing" TIMESTAMP(3),
    "active_date" TIMESTAMP(3),
    "next_billing" TIMESTAMP(3),
    "hold_date" DATE,
    "hold_reason" TEXT,
    "inactive" BOOLEAN DEFAULT false,
    "last_transaction_type" TEXT,
    "smoker" TEXT,
    "batch_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_paste" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_terms_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chargeback_submissions" ADD CONSTRAINT "chargeback_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_terms" ADD CONSTRAINT "pending_terms_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
