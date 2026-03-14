import { prisma } from "@ops/db";
import { emitAuditStarted, emitAuditStatus, emitAuditFailed } from "../socket";

const MAX_CONCURRENT = 3;
const RECORDING_MAX_RETRIES = 10;
const RECORDING_RETRY_DELAY_MS = 60_000; // 60 seconds

const pendingJobs: string[] = [];
const activeJobs = new Set<string>();

export function enqueueAuditJob(callLogId: string): void {
  if (activeJobs.has(callLogId) || pendingJobs.includes(callLogId)) return;
  pendingJobs.push(callLogId);
  processNext();
}

function processNext(): void {
  while (activeJobs.size < MAX_CONCURRENT && pendingJobs.length > 0) {
    const callLogId = pendingJobs.shift()!;
    activeJobs.add(callLogId);
    runJob(callLogId).finally(() => {
      activeJobs.delete(callLogId);
      processNext();
    });
  }
}

async function runJob(callLogId: string): Promise<void> {
  try {
    const callLog = await prisma.convosoCallLog.findUnique({
      where: { id: callLogId },
      include: { agent: true },
    });
    if (!callLog?.recordingUrl) return;

    const agentName = callLog.agent?.name ?? callLog.agentUser;
    emitAuditStarted({ callLogId, agentName });

    // Download recording with retry
    const audioBuffer = await downloadRecordingWithRetry(callLogId, callLog.recordingUrl);

    // Hand off to the processing pipeline
    const { processCallRecording } = await import("./callAudit");
    await processCallRecording(callLogId, audioBuffer);
  } catch (err: any) {
    console.error(`[auditQueue] Job failed for ${callLogId}:`, err);
    emitAuditFailed({ callLogId, error: err.message ?? "Unknown error" });
    await prisma.convosoCallLog.update({
      where: { id: callLogId },
      data: { auditStatus: "failed" },
    }).catch(() => {});
  }
}

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
        // 404/403 likely means recording not ready yet
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Recording not ready for ${callLogId} (HTTP ${res.status}), attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`Recording download failed after ${RECORDING_MAX_RETRIES} attempts: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Check for empty response (recording not ready)
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
    } catch (err: any) {
      // Network errors — retry
      if (err.message?.includes("fetch") || err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
        if (attempt < RECORDING_MAX_RETRIES) {
          console.log(`[auditQueue] Network error for ${callLogId}: ${err.message}, attempt ${attempt}/${RECORDING_MAX_RETRIES}, retrying in 60s...`);
          await sleep(RECORDING_RETRY_DELAY_MS);
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error(`Recording download failed after ${RECORDING_MAX_RETRIES} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
