import { prisma } from "@ops/db";
import { emitAuditStarted, emitAuditStatus, emitAuditFailed } from "../socket";
import type { AuditUsageInfo } from "./callAudit";

const MAX_CONCURRENT = 3;
const RECORDING_MAX_RETRIES = 10;
const RECORDING_RETRY_DELAY_MS = 60_000; // 60 seconds
const POLL_INTERVAL_MS = 30_000; // Poll every 30 seconds
const MIN_CALL_DURATION = 120; // 2 minutes minimum

const activeJobs = new Set<string>();
let pollingInterval: NodeJS.Timeout | null = null;

// ── Enqueue a single call for audit (marks as "queued" in DB) ────

export async function enqueueAuditJob(callLogId: string): Promise<void> {
  if (activeJobs.has(callLogId)) return;
  await prisma.convosoCallLog.update({
    where: { id: callLogId },
    data: { auditStatus: "queued" },
  });
  processNext();
}

// ── Batch enqueue eligible calls for auto-scoring ────────────────

export async function enqueueAutoScore(): Promise<number> {
  // Only audit calls from the day scoring was enabled onward (midnight UTC)
  const enabledAtSetting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled_at" } });
  let enabledAt: Date | null = null;
  if (enabledAtSetting?.value) {
    enabledAt = new Date(enabledAtSetting.value);
    enabledAt.setUTCHours(0, 0, 0, 0); // Start of the day it was enabled
  }

  // Use configurable duration filter from Owner dashboard settings
  const [minSetting, maxSetting] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
  ]);
  const minDuration = minSetting?.value ? Number(minSetting.value) : MIN_CALL_DURATION;
  const maxDuration = maxSetting?.value ? Number(maxSetting.value) : undefined;

  const eligible = await prisma.convosoCallLog.findMany({
    where: {
      auditStatus: "pending",
      recordingUrl: { not: null },
      callDurationSeconds: {
        gte: minDuration,
        ...(maxDuration ? { lte: maxDuration } : {}),
      },
      ...(enabledAt ? { callTimestamp: { gte: enabledAt } } : {}),
    },
    select: { id: true },
    take: 50,
  });

  if (eligible.length === 0) return 0;

  await prisma.convosoCallLog.updateMany({
    where: { id: { in: eligible.map((e) => e.id) } },
    data: { auditStatus: "queued" },
  });

  return eligible.length;
}

// ── Budget check ─────────────────────────────────────────────────

async function checkDailyBudget(): Promise<boolean> {
  const budgetSetting = await prisma.salesBoardSetting.findUnique({
    where: { key: "ai_daily_budget_cap" },
  });
  const dailyBudget = budgetSetting ? parseFloat(budgetSetting.value) : 10.0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayUsage = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: today, lt: tomorrow } },
    _sum: { estimatedCost: true },
  });

  const spent = Number(todayUsage._sum.estimatedCost || 0);
  return spent < dailyBudget;
}

// ── DB-backed polling for queued jobs ────────────────────────────

async function pollPendingJobs(): Promise<void> {
  if (activeJobs.size >= MAX_CONCURRENT) return;

  // Check if AI scoring is enabled
  const enabledSetting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled" } });
  if (!enabledSetting || enabledSetting.value !== "true") return;

  const withinBudget = await checkDailyBudget();
  if (!withinBudget) return;

  const pending = await prisma.convosoCallLog.findMany({
    where: {
      auditStatus: "queued",
      recordingUrl: { not: null },
    },
    orderBy: { callTimestamp: "asc" },
    take: MAX_CONCURRENT - activeJobs.size,
    select: { id: true },
  });

  for (const job of pending) {
    if (activeJobs.has(job.id)) continue;
    activeJobs.add(job.id);
    runJob(job.id).finally(() => {
      activeJobs.delete(job.id);
    });
  }
}

// ── Process next (immediate trigger after enqueue) ───────────────

function processNext(): void {
  pollPendingJobs().catch((err) => {
    console.error("[auditQueue] pollPendingJobs error:", err);
  });
}

// ── Run a single audit job ───────────────────────────────────────

async function runJob(callLogId: string): Promise<void> {
  try {
    const callLog = await prisma.convosoCallLog.findUnique({
      where: { id: callLogId },
      include: { agent: true },
    });
    if (!callLog?.recordingUrl) return;

    const agentName = callLog.agent?.name ?? callLog.agentUser;
    emitAuditStarted({ callLogId, agentName });

    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { auditStatus: "processing" },
    });

    // Download recording with retry
    const audioBuffer = await downloadRecordingWithRetry(callLogId, callLog.recordingUrl);

    // Hand off to the processing pipeline
    const { processCallRecording } = await import("./callAudit");
    const usageInfo: AuditUsageInfo | void = await processCallRecording(callLogId, audioBuffer);

    // Log usage if result includes token info
    if (usageInfo && usageInfo.inputTokens != null) {
      await prisma.aiUsageLog.create({
        data: {
          callLogId,
          model: usageInfo.model || "claude-sonnet-4-20250514",
          inputTokens: usageInfo.inputTokens || 0,
          outputTokens: usageInfo.outputTokens || 0,
          estimatedCost: usageInfo.estimatedCost || 0,
        },
      });
    }
  } catch (err: unknown) {
    console.error(`[auditQueue] Job failed for ${callLogId}:`, err);
    emitAuditFailed({ callLogId, error: err instanceof Error ? err.message : "Unknown error" });
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { auditStatus: "failed" },
    }).catch(() => {});
  }
}

// ── Recording download with retry ────────────────────────────────

async function downloadRecordingWithRetry(callLogId: string, url: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= RECORDING_MAX_RETRIES; attempt++) {
    try {
      emitAuditStatus({ callLogId, status: "waiting_recording", attempt });
      await prisma.convosoCallLog.update({
        where: { id: callLogId },
        data: { auditStatus: "waiting_recording" },
      });

      const res = await fetch(url);

      if (!res.ok) {
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Recording not ready for ${callLogId} (HTTP ${res.status}), attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`Recording download failed after ${RECORDING_MAX_RETRIES} attempts: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      if (buffer.length === 0) {
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Empty recording for ${callLogId}, attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`Recording empty after ${RECORDING_MAX_RETRIES} attempts`);
      }

      console.log(`[auditQueue] Recording downloaded for ${callLogId} (${buffer.length} bytes, attempt ${attempt})`);
      return buffer;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errCode = (err as NodeJS.ErrnoException)?.code;
      if (errMsg.includes("fetch") || errCode === "ECONNREFUSED" || errCode === "ETIMEDOUT") {
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Network error for ${callLogId}: ${errMsg}, attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error(`Recording download failed after ${RECORDING_MAX_RETRIES} attempts`);
}

// ── Auto-score polling lifecycle ─────────────────────────────────

export function startAutoScorePolling(): void {
  if (pollingInterval) return;
  pollingInterval = setInterval(async () => {
    try {
      // Enqueue any new eligible calls before polling for queued jobs
      await enqueueAutoScore();
      await pollPendingJobs();
    } catch (err) {
      console.error("[auditQueue] Polling error:", err);
    }
  }, POLL_INTERVAL_MS);
  // Run immediately on start
  enqueueAutoScore().then(() => pollPendingJobs()).catch(() => {});
}

// ── AI usage stats ───────────────────────────────────────────────

export async function getAiUsageStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayUsage = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: today, lt: tomorrow } },
    _sum: { estimatedCost: true },
    _count: true,
  });

  const budgetSetting = await prisma.salesBoardSetting.findUnique({
    where: { key: "ai_daily_budget_cap" },
  });

  const queuedCount = await prisma.convosoCallLog.count({
    where: { auditStatus: "queued" },
  });

  return {
    todaySpent: Number(todayUsage._sum.estimatedCost || 0),
    todayCount: todayUsage._count || 0,
    dailyBudget: budgetSetting ? parseFloat(budgetSetting.value) : 10.0,
    queuedCount,
    estimatedMonthly: Number(todayUsage._sum.estimatedCost || 0) * 30,
  };
}

// ── Utility ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
