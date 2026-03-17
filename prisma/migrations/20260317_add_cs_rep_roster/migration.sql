-- AlterTable: add assigned_to to chargeback_submissions
ALTER TABLE "chargeback_submissions" ADD COLUMN "assigned_to" TEXT;

-- CreateTable: cs_rep_roster
CREATE TABLE "cs_rep_roster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cs_rep_roster_pkey" PRIMARY KEY ("id")
);
