-- CreateEnum
CREATE TYPE "WorkflowQueueStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowArtifactType" AS ENUM ('BRIEF', 'PLAN', 'DRAFT', 'DEPLOYMENT_LOG');

-- CreateEnum
CREATE TYPE "PendingApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "workflow_queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WorkflowQueueStatus" NOT NULL DEFAULT 'QUEUED',
    "claimed_at" TIMESTAMP(3),
    "claimed_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "fail_attempts" INTEGER NOT NULL DEFAULT 0,
    "reclaim_count" INTEGER NOT NULL DEFAULT 0,
    "max_fail_attempts" INTEGER NOT NULL DEFAULT 3,
    "max_reclaim_count" INTEGER NOT NULL DEFAULT 5,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_artifacts" (
    "id" TEXT NOT NULL,
    "queue_id" TEXT NOT NULL,
    "type" "WorkflowArtifactType" NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "submitted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_approvals" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "status" "PendingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decision_by" TEXT,
    "decision_at" TIMESTAMP(3),
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_queue_work_id_key" ON "workflow_queue"("work_id");

-- CreateIndex
CREATE INDEX "workflow_queue_status_created_at_idx" ON "workflow_queue"("status", "created_at");

-- CreateIndex
CREATE INDEX "workflow_queue_status_claimed_at_idx" ON "workflow_queue"("status", "claimed_at");

-- CreateIndex
CREATE INDEX "workflow_queue_claimed_by_idx" ON "workflow_queue"("claimed_by");

-- CreateIndex
CREATE INDEX "workflow_artifacts_queue_id_idx" ON "workflow_artifacts"("queue_id");

-- CreateIndex
CREATE INDEX "workflow_artifacts_type_created_at_idx" ON "workflow_artifacts"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pending_approvals_artifact_id_key" ON "pending_approvals"("artifact_id");

-- CreateIndex
CREATE INDEX "pending_approvals_status_created_at_idx" ON "pending_approvals"("status", "created_at");

-- AddForeignKey
ALTER TABLE "workflow_artifacts" ADD CONSTRAINT "workflow_artifacts_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "workflow_queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "workflow_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
