import { prisma } from "@ops/db";
import { z, type ZodSchema } from "zod";
import type { Prisma, WorkflowArtifactType, WorkflowQueue, WorkflowQueueStatus } from "@prisma/client";
import { logAudit } from "./audit";

// ── Custom errors ─────────────────────────────────────────────────
// Mapped to HTTP status codes by the workflow route error mapper.
// Generic messages only (no internal detail leak — see plan AC-7).

export class ConflictError extends Error {
  statusCode = 409;
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message = "not_found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  details: unknown;
  constructor(message: string, details: unknown) {
    super(message);
    this.details = details;
    this.name = "ValidationError";
  }
}

// ── Artifact payload schemas (per type) ───────────────────────────
// Stubs for Plan 02-01 smoke test; full schemas fill in during 02-02.
// Bumping any payload_version requires consumer backward-compat OR data migration
// (see plan's Schema Evolution policy).

export const artifactSchemas: Record<WorkflowArtifactType, ZodSchema> = {
  BRIEF: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1),
  }),
  PLAN: z.unknown(),
  DRAFT: z.unknown(),
  DEPLOYMENT_LOG: z.unknown(),
};

// Error field is capped at 2000 chars at the app layer (audit deferral #18).
const ERROR_MAX_LENGTH = 2000;
const truncate = (s: string, max = ERROR_MAX_LENGTH) => (s.length <= max ? s : s.slice(0, max));

// ── claimNextWork ─────────────────────────────────────────────────
// Atomic claim via Postgres FOR UPDATE SKIP LOCKED — the sole atomicity primitive.
// Safe under concurrent pollers at any scale; no application-level locking.

export async function claimNextWork(claimedBy: string): Promise<WorkflowQueue | null> {
  const rows = await prisma.$queryRaw<WorkflowQueue[]>`
    UPDATE "workflow_queue"
    SET status = 'IN_PROGRESS'::"WorkflowQueueStatus",
        claimed_at = NOW(),
        claimed_by = ${claimedBy},
        updated_at = NOW()
    WHERE id = (
      SELECT id FROM "workflow_queue"
      WHERE status = 'QUEUED'::"WorkflowQueueStatus"
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;

  const claimed = rows[0] ?? null;
  if (claimed) {
    await logAudit(null, "workflow.claim", "WorkflowQueue", claimed.id, {
      claimed_by: claimedBy,
      type: claimed.type,
      work_id: claimed.workId,
      before: "QUEUED",
      after: "IN_PROGRESS",
    });
  }
  return claimed;
}

// ── completeWork ───────────────────────────────────────────────────
// Transactional + idempotent via work_id + caller-verified via claimed_by.
// Second call with matching work_id returns existing artifactId without duplicating.

export async function completeWork(
  queueId: string,
  workId: string,
  claimedBy: string,
  artifactInput: { type: WorkflowArtifactType; payload?: unknown },
): Promise<{ artifactId: string }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.workflowQueue.findUnique({ where: { id: queueId } });
    if (!row) throw new NotFoundError("queue_not_found");

    // Idempotency: already complete with matching work_id → return existing artifact.
    if (row.status === "COMPLETE" && row.workId === workId) {
      const existing = await tx.workflowArtifact.findFirst({
        where: { queueId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (existing) return { artifactId: existing.id };
      throw new ConflictError("complete_without_artifact");
    }

    if (row.status !== "IN_PROGRESS") throw new ConflictError("not_in_progress");
    if (row.workId !== workId) throw new ConflictError("work_id_mismatch");
    if (row.claimedBy !== claimedBy) throw new ConflictError("caller_identity_mismatch");

    const schema = artifactSchemas[artifactInput.type];
    const parsed = schema.safeParse(artifactInput.payload);
    if (!parsed.success) {
      throw new ValidationError("artifact_payload_invalid", parsed.error.flatten());
    }

    const artifact = await tx.workflowArtifact.create({
      data: {
        queueId,
        type: artifactInput.type,
        payload: parsed.data as Prisma.InputJsonValue,
        payloadVersion: 1,
        submittedBy: claimedBy,
      },
      select: { id: true },
    });

    await tx.workflowQueue.update({
      where: { id: queueId },
      data: { status: "COMPLETE", completedAt: new Date(), claimedBy: null },
    });

    await logAudit(null, "workflow.complete", "WorkflowQueue", queueId, {
      claimed_by: claimedBy,
      work_id: workId,
      artifact_type: artifactInput.type,
      artifact_id: artifact.id,
      before: "IN_PROGRESS",
      after: "COMPLETE",
    });

    return { artifactId: artifact.id };
  });
}

// ── failWork ──────────────────────────────────────────────────────
// Split counters: fail_attempts increments on EXPLICIT failures from buckets.
// Sweeper uses reclaim_count separately — napping laptops don't burn the retry budget.

export async function failWork(
  queueId: string,
  workId: string,
  claimedBy: string,
  errorMessage: string,
): Promise<{ status: WorkflowQueueStatus }> {
  const truncated = truncate(errorMessage);
  return prisma.$transaction(async (tx) => {
    const row = await tx.workflowQueue.findUnique({ where: { id: queueId } });
    if (!row) throw new NotFoundError("queue_not_found");
    if (row.status !== "IN_PROGRESS") throw new ConflictError("not_in_progress");
    if (row.workId !== workId) throw new ConflictError("work_id_mismatch");
    if (row.claimedBy !== claimedBy) throw new ConflictError("caller_identity_mismatch");

    const nextFailAttempts = row.failAttempts + 1;
    const permanentFail = nextFailAttempts >= row.maxFailAttempts;
    const nextStatus: WorkflowQueueStatus = permanentFail ? "FAILED" : "QUEUED";

    await tx.workflowQueue.update({
      where: { id: queueId },
      data: {
        status: nextStatus,
        failAttempts: nextFailAttempts,
        claimedAt: null,
        claimedBy: null,
        error: truncated,
      },
    });

    await logAudit(null, "workflow.fail", "WorkflowQueue", queueId, {
      claimed_by: claimedBy,
      work_id: workId,
      fail_attempts: nextFailAttempts,
      max_fail_attempts: row.maxFailAttempts,
      before: "IN_PROGRESS",
      after: nextStatus,
      error_preview: truncated.slice(0, 200),
    });

    return { status: nextStatus };
  });
}
