// Unit tests for Phase 2 workflow communication layer.
//
// Strategy: mock @ops/db prisma methods per-test to verify service logic flow.
// True atomicity / transactional / concurrent-claim tests require a real DB and
// are marked .skip with a comment pointing at the follow-up plan that will
// add docker-compose-postgres test fixtures.

import type { NextFunction, Request, Response } from "express";
import { prisma } from "@ops/db";
import {
  claimNextWork,
  completeWork,
  failWork,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../workflow";
import { createWorkflowAuth } from "../../middleware/workflow-auth";

// ── Shared helpers ────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  workflowQueue: { findUnique: jest.Mock; update: jest.Mock };
  workflowArtifact: { create: jest.Mock; findFirst: jest.Mock };
  appAuditLog: { create: jest.Mock };
};

function resetPrismaMock() {
  mockPrisma.$queryRaw = jest.fn();
  mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));
  mockPrisma.workflowQueue = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  mockPrisma.workflowArtifact = {
    create: jest.fn(),
    findFirst: jest.fn(),
  };
  mockPrisma.appAuditLog = { create: jest.fn() };
}

function makeQueueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    type: "analyze_sales",
    workId: "w-1",
    payload: {},
    status: "IN_PROGRESS",
    claimedAt: new Date("2026-04-17T12:00:00Z"),
    claimedBy: "bucket-X",
    completedAt: null,
    failAttempts: 0,
    reclaimCount: 0,
    maxFailAttempts: 3,
    maxReclaimCount: 5,
    error: null,
    createdAt: new Date("2026-04-17T11:00:00Z"),
    updatedAt: new Date("2026-04-17T11:00:00Z"),
    ...overrides,
  };
}

function mockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { authorization: "", "user-agent": "test", ...headers },
    ip: "127.0.0.1",
  } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

// ── workflowAuth middleware ───────────────────────────────────────

describe("workflowAuth middleware", () => {
  const TEST_TOKEN = "a".repeat(64);
  let middleware: ReturnType<typeof createWorkflowAuth>;

  beforeAll(() => {
    process.env.WORKFLOW_API_TOKEN = TEST_TOKEN;
    middleware = createWorkflowAuth();
  });

  afterAll(() => {
    delete process.env.WORKFLOW_API_TOKEN;
  });

  it("throws at factory-call time when WORKFLOW_API_TOKEN is missing", () => {
    const prev = process.env.WORKFLOW_API_TOKEN;
    delete process.env.WORKFLOW_API_TOKEN;
    expect(() => createWorkflowAuth()).toThrow(/WORKFLOW_API_TOKEN/);
    process.env.WORKFLOW_API_TOKEN = prev;
  });

  it("throws at factory-call time when WORKFLOW_API_TOKEN is too short", () => {
    const prev = process.env.WORKFLOW_API_TOKEN;
    process.env.WORKFLOW_API_TOKEN = "short";
    expect(() => createWorkflowAuth()).toThrow(/at least 32 chars/);
    process.env.WORKFLOW_API_TOKEN = prev;
  });

  it("returns 401 generic body when Authorization header is missing", () => {
    const { req, res, next } = mockReqRes();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with 'Bearer '", () => {
    const { req, res, next } = mockReqRes({ authorization: `Token ${TEST_TOKEN}` });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for Bearer with empty token", () => {
    const { req, res, next } = mockReqRes({ authorization: "Bearer " });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for whitespace-padded token", () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer  ${TEST_TOKEN}  ` });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for length-mismatched token", () => {
    const { req, res, next } = mockReqRes({ authorization: "Bearer shortertoken" });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for length-match but wrong token", () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${"b".repeat(64)}` });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() on valid bearer token", () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${TEST_TOKEN}` });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("never logs the token material on rejection", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${TEST_TOKEN.replace(/a/g, "z")}` });
    middleware(req, res, next);
    const logged = warnSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain(TEST_TOKEN);
    expect(logged).not.toContain("z".repeat(10));
    warnSpy.mockRestore();
  });
});

// ── claimNextWork ─────────────────────────────────────────────────

describe("claimNextWork", () => {
  beforeEach(() => resetPrismaMock());

  it("returns null when queue is empty", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    const result = await claimNextWork("bucket-X");
    expect(result).toBeNull();
    expect(mockPrisma.appAuditLog.create).not.toHaveBeenCalled();
  });

  it("returns claimed row and emits audit entry", async () => {
    const row = makeQueueRow({ status: "IN_PROGRESS", claimedBy: "bucket-X" });
    mockPrisma.$queryRaw.mockResolvedValueOnce([row]);
    const result = await claimNextWork("bucket-X");
    expect(result).toEqual(row);
    expect(mockPrisma.appAuditLog.create).toHaveBeenCalledTimes(1);
    const auditCall = mockPrisma.appAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe("workflow.claim");
    expect(auditCall.data.entityId).toBe(row.id);
    expect(auditCall.data.metadata.claimed_by).toBe("bucket-X");
  });
});

// ── completeWork ───────────────────────────────────────────────────

describe("completeWork", () => {
  beforeEach(() => resetPrismaMock());

  it("rejects when queue row does not exist → NotFoundError", async () => {
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(null);
    await expect(
      completeWork("missing", "w-1", "bucket-X", { type: "BRIEF", payload: { title: "t", body: "b" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is idempotent: already COMPLETE + matching work_id returns existing artifactId", async () => {
    const row = makeQueueRow({ status: "COMPLETE" });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowArtifact.findFirst.mockResolvedValueOnce({ id: "art-existing" });
    const result = await completeWork("q-1", "w-1", "bucket-X", {
      type: "BRIEF",
      payload: { title: "t", body: "b" },
    });
    expect(result).toEqual({ artifactId: "art-existing" });
    expect(mockPrisma.workflowArtifact.create).not.toHaveBeenCalled();
  });

  it("rejects when status is not IN_PROGRESS → ConflictError(not_in_progress)", async () => {
    const row = makeQueueRow({ status: "QUEUED" });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    await expect(
      completeWork("q-1", "w-1", "bucket-X", { type: "BRIEF", payload: { title: "t", body: "b" } }),
    ).rejects.toMatchObject({ code: "not_in_progress" });
  });

  it("rejects on work_id mismatch → ConflictError(work_id_mismatch)", async () => {
    const row = makeQueueRow({ workId: "w-1" });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    await expect(
      completeWork("q-1", "w-different", "bucket-X", { type: "BRIEF", payload: { title: "t", body: "b" } }),
    ).rejects.toMatchObject({ code: "work_id_mismatch" });
  });

  it("rejects on claimed_by mismatch → ConflictError(caller_identity_mismatch)", async () => {
    const row = makeQueueRow({ claimedBy: "bucket-X" });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    await expect(
      completeWork("q-1", "w-1", "bucket-Y", { type: "BRIEF", payload: { title: "t", body: "b" } }),
    ).rejects.toMatchObject({ code: "caller_identity_mismatch" });
  });

  it("rejects invalid BRIEF payload via Zod → ValidationError", async () => {
    const row = makeQueueRow();
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    await expect(
      completeWork("q-1", "w-1", "bucket-X", { type: "BRIEF", payload: { title: "t" } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("creates artifact, updates queue to COMPLETE, emits audit entry on success", async () => {
    const row = makeQueueRow();
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowArtifact.create.mockResolvedValueOnce({ id: "art-new" });
    mockPrisma.workflowQueue.update.mockResolvedValueOnce({ ...row, status: "COMPLETE" });

    const result = await completeWork("q-1", "w-1", "bucket-X", {
      type: "BRIEF",
      payload: { title: "Hook", body: "Some body text" },
    });

    expect(result).toEqual({ artifactId: "art-new" });
    expect(mockPrisma.workflowArtifact.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.workflowQueue.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: expect.objectContaining({ status: "COMPLETE", claimedBy: null }),
    });
    expect(mockPrisma.appAuditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appAuditLog.create.mock.calls[0][0].data.action).toBe("workflow.complete");
  });
});

// ── failWork — split counters ─────────────────────────────────────

describe("failWork", () => {
  beforeEach(() => resetPrismaMock());

  it("re-queues row when fail_attempts < max_fail_attempts", async () => {
    const row = makeQueueRow({ failAttempts: 0, maxFailAttempts: 3 });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowQueue.update.mockResolvedValueOnce({ ...row, status: "QUEUED", failAttempts: 1 });

    const result = await failWork("q-1", "w-1", "bucket-X", "transient error");

    expect(result).toEqual({ status: "QUEUED" });
    const updateCall = mockPrisma.workflowQueue.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("QUEUED");
    expect(updateCall.data.failAttempts).toBe(1);
    expect(updateCall.data.claimedAt).toBeNull();
    expect(updateCall.data.claimedBy).toBeNull();
  });

  it("permanent-fails row when fail_attempts reaches max_fail_attempts", async () => {
    const row = makeQueueRow({ failAttempts: 2, maxFailAttempts: 3 });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowQueue.update.mockResolvedValueOnce({ ...row, status: "FAILED", failAttempts: 3 });

    const result = await failWork("q-1", "w-1", "bucket-X", "final error");

    expect(result).toEqual({ status: "FAILED" });
    expect(mockPrisma.workflowQueue.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("truncates error messages longer than 2000 chars", async () => {
    const row = makeQueueRow();
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowQueue.update.mockResolvedValueOnce({ ...row, status: "QUEUED", failAttempts: 1 });

    const longError = "x".repeat(5000);
    await failWork("q-1", "w-1", "bucket-X", longError);

    const updateCall = mockPrisma.workflowQueue.update.mock.calls[0][0];
    expect(updateCall.data.error).toHaveLength(2000);
  });

  it("rejects on claimed_by mismatch", async () => {
    const row = makeQueueRow({ claimedBy: "bucket-X" });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    await expect(failWork("q-1", "w-1", "bucket-Y", "err")).rejects.toMatchObject({
      code: "caller_identity_mismatch",
    });
  });

  it("does NOT increment reclaim_count (separate budget)", async () => {
    const row = makeQueueRow({ failAttempts: 0, reclaimCount: 2 });
    mockPrisma.workflowQueue.findUnique.mockResolvedValueOnce(row);
    mockPrisma.workflowQueue.update.mockResolvedValueOnce({ ...row, status: "QUEUED" });

    await failWork("q-1", "w-1", "bucket-X", "err");

    const updateCall = mockPrisma.workflowQueue.update.mock.calls[0][0];
    expect(updateCall.data.failAttempts).toBe(1);
    // reclaim_count must not be touched by failWork
    expect(updateCall.data.reclaimCount).toBeUndefined();
  });
});

// ── Sweeper (DB-dependent; marked .skip) ──────────────────────────
//
// These cover: reclaim stuck row + increment reclaim_count; permanent-fail at
// reclaim limit; leave fresh/non-in-progress rows alone; emit heartbeat every
// tick; exception-resilient tick loop. They require a real Postgres to
// exercise `NOW() - INTERVAL` SQL and transactional semantics — mocking the
// raw SQL defeats the atomicity guarantees we're actually testing.
//
// When docker-compose postgres + migration blocker are resolved (user's
// parallel session on 2026-04-17), un-skip + add a `beforeAll` that seeds the
// test DB schema, and a `beforeEach` that truncates workflow_queue.

describe.skip("workflow sweeper (requires real DB)", () => {
  it("reclaims stuck IN_PROGRESS row with reclaim_count < max; bumps reclaim_count", () => {});
  it("permanent-fails row when reclaim_count >= max_reclaim_count", () => {});
  it("leaves non-IN_PROGRESS rows untouched", () => {});
  it("leaves fresh IN_PROGRESS (< 10 min old) rows untouched", () => {});
  it("emits workflow_sweep heartbeat even when 0 reclaimed", () => {});
  it("continues running after a tick exception (logs error, does not kill timer)", () => {});
  it("releaseInFlight clears rows matching claimed_by only", () => {});
});

// ── Integration (race + shutdown) — marked .skip ──────────────────
//
// Race: complete-vs-sweeper needs two DB connections and setTimeout
// choreography. Graceful shutdown needs SIGTERM to a real ops-api process.
// Both require the same follow-up plan that unblocks the sweeper tests above.

describe.skip("workflow integration (requires real DB + process fixtures)", () => {
  it("race: completeWork mid-transaction wins over concurrent sweeper tick", () => {});
  it("SIGTERM releases claims with claimed_by matching this process, logs audit entry", () => {});
  it("two concurrent polls against one queued row: exactly one wins, other gets null", () => {});
});
