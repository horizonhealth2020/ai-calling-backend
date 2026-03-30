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
  // Global gate: only audit calls after scoring was enabled
  const enabledAtSetting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled_at" } });
  const globalEnabledAt = enabledAtSetting?.value ? new Date(enabledAtSetting.value) : null;

  // Use configurable duration filter from Owner dashboard settings
  const [minSetting, maxSetting] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
  ]);
  const minDuration = minSetting?.value ? Number(minSetting.value) : MIN_CALL_DURATION;
  const maxDuration = maxSetting?.value ? Number(maxSetting.value) : undefined;

  // Get agents with audit enabled and their individual enabled-at timestamps
  const auditAgents = await prisma.agent.findMany({
    where: { auditEnabled: true, active: true },
    select: { id: true, auditEnabledAt: true },
  });

  if (auditAgents.length === 0) return 0;

  // Build per-agent eligibility: call must be after BOTH global and agent enabledAt
  const agentIds = auditAgents.map((a) => a.id);
  const agentCutoffs = new Map(auditAgents.map((a) => [a.id, a.auditEnabledAt]));

  // Use the LATER of global and per-agent timestamps for each call
  // Query candidates: agent is audit-enabled, meets duration, has recording
  const candidates = await prisma.convosoCallLog.findMany({
    where: {
      auditStatus: "pending",
      recordingUrl: { not: null },
      agentId: { in: agentIds },
      callDurationSeconds: {
        gte: minDuration,
        ...(maxDuration ? { lte: maxDuration } : {}),
      },
    },
    select: { id: true, agentId: true, callTimestamp: true },
    take: 100,
  });

  // Filter by the LATER of global enabledAt and per-agent auditEnabledAt
  const eligible = candidates.filter((c) => {
    if (!c.agentId || !c.callTimestamp) return false;
    const agentCutoff = agentCutoffs.get(c.agentId);
    // Use the later of global and agent timestamps as the cutoff
    const cutoff = agentCutoff && globalEnabledAt
      ? (agentCutoff > globalEnabledAt ? agentCutoff : globalEnabledAt)
      : agentCutoff ?? globalEnabledAt;
    if (!cutoff) return true; // No timestamps at all = eligible
    return c.callTimestamp >= cutoff;
  }).slice(0, 50);

  console.log(JSON.stringify({
    event: "audit_enqueue_check",
    globalEnabledAt: globalEnabledAt?.toISOString() ?? null,
    auditAgents: auditAgents.length,
    minDuration,
    candidates: candidates.length,
    eligible: eligible.length,
    sampleCandidate: candidates[0] ? {
      callTimestamp: candidates[0].callTimestamp?.toISOString() ?? null,
      agentId: candidates[0].agentId,
    } : null,
    timestamp: new Date().toISOString(),
  }));

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
  if (activeJobs.size >= MAX_CONCURRENT) return; // Normal — job in progress, next poll will pick up queued calls

  // Check if AI scoring is enabled
  const enabledSetting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled" } });
  if (!enabledSetting || enabledSetting.value !== "true") {
    console.log(JSON.stringify({ event: "audit_poll_skip", reason: "scoring_disabled", settingValue: enabledSetting?.value ?? null, timestamp: new Date().toISOString() }));
    return;
  }

  const withinBudget = await checkDailyBudget();
  if (!withinBudget) {
    console.log(JSON.stringify({ event: "audit_poll_skip", reason: "daily_budget_exhausted", timestamp: new Date().toISOString() }));
    return;
  }

  const pending = await prisma.convosoCallLog.findMany({
    where: {
      auditStatus: "queued",
      recordingUrl: { not: null },
    },
    orderBy: { callTimestamp: "desc" },
    take: MAX_CONCURRENT - activeJobs.size,
    select: { id: true },
  });

  if (pending.length === 0) {
    // Count stuck jobs for diagnostics
    const [queuedCount, failedCount, processingCount] = await Promise.all([
      prisma.convosoCallLog.count({ where: { auditStatus: "queued" } }),
      prisma.convosoCallLog.count({ where: { auditStatus: "failed" } }),
      prisma.convosoCallLog.count({ where: { auditStatus: { in: ["processing", "waiting_recording", "transcribing", "auditing"] } } }),
    ]);
    console.log(JSON.stringify({ event: "audit_poll_empty", queued: queuedCount, failed: failedCount, inProgress: processingCount, activeJobs: activeJobs.size, timestamp: new Date().toISOString() }));
  }

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

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

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

      if (!isValidAudioBuffer(buffer)) {
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Invalid audio buffer for ${callLogId} (${buffer.length} bytes, first bytes: ${buffer.subarray(0, 16).toString('hex')}), attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`Recording has invalid audio content after ${RECORDING_MAX_RETRIES} attempts (${buffer.length} bytes, header: ${buffer.subarray(0, 16).toString('hex')})`);
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

export async function repairScoringCutoff(): Promise<void> {
  // If ai_scoring_enabled_at was set today (from a toggle), backdate it to the
  // earliest agent auditEnabledAt so older pending calls aren't permanently blocked.
  try {
    const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled_at" } });
    if (!setting) return;
    const earliest = await prisma.agent.findFirst({
      where: { auditEnabled: true, auditEnabledAt: { not: null } },
      orderBy: { auditEnabledAt: "asc" },
      select: { auditEnabledAt: true },
    });
    if (earliest?.auditEnabledAt && new Date(setting.value) > earliest.auditEnabledAt) {
      await prisma.salesBoardSetting.update({
        where: { key: "ai_scoring_enabled_at" },
        data: { value: earliest.auditEnabledAt.toISOString() },
      });
      console.log(`[auditQueue] Repaired ai_scoring_enabled_at: ${setting.value} → ${earliest.auditEnabledAt.toISOString()}`);
    }
  } catch (err) {
    console.error("[auditQueue] repairScoringCutoff error:", err);
  }
}

export function startAutoScorePolling(): void {
  if (pollingInterval) return;
  // One-time repair on startup
  repairScoringCutoff().catch(() => {});
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

// ── Audio buffer validation ──────────────────────────────────────

/**
 * Checks whether a buffer contains valid audio data by inspecting magic bytes.
 * Returns false for HTML error pages, JSON responses, too-small files, or
 * unrecognized formats. Logs a warning with hex dump when returning false.
 */
export function isValidAudioBuffer(buffer: Buffer): boolean {
  if (buffer.length < 256) return false;

  // WAV: RIFF....WAVE
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45
  ) return true;

  // MP3 frame sync: 0xFF followed by byte with top 3 bits set (0xE0 mask)
  // Covers all MPEG versions (1/2/2.5) and layers (1/2/3): 0xFB, 0xF3, 0xF2, 0xE3, etc.
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;

  // MP3 ID3 tag
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;

  // OGG: "OggS"
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return true;

  // FLAC: "fLaC"
  if (buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43) return true;

  // WebM/Matroska: 0x1A 0x45 0xDF 0xA3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;

  // No recognized audio header
  console.warn(`[auditQueue] Invalid audio buffer: first 16 bytes = ${buffer.subarray(0, 16).toString("hex")}, length = ${buffer.length}`);
  return false;
}

// ── Utility ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
