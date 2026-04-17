import { prisma } from "@ops/db";
import { logAudit } from "../services/audit";

// WorkflowQueue timeout sweeper.
//
// Uses setInterval (not Bull — not wired in ops-api; see plan deviation note).
// Every tick, two transactional UPDATEs:
//   1. Permanent-fail stuck rows whose reclaim_count has hit the limit
//   2. Reclaim other stuck rows back to QUEUED, bump reclaim_count
//
// Stuck = status=IN_PROGRESS AND claimed_at < NOW() - stuckThresholdMs.
//
// Heartbeat: every tick emits a structured log line (including 0-reclaim ticks)
// so silent sweeper death can be spotted by external monitoring.
//
// Exception-resilient: tick errors are caught and logged at ERROR level; the
// timer continues running so one bad tick doesn't permanently stop the sweeper.

const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_STUCK_THRESHOLD_MS = 10 * 60 * 1000;

interface SweeperOptions {
  intervalMs?: number;
  stuckThresholdMs?: number;
}

interface SweeperHandle {
  tick: () => Promise<{ reclaimed: number; permanentFailed: number }>;
  stop: () => void;
  releaseInFlight: (claimedBy: string) => Promise<number>;
}

function heartbeat(tickId: string, reclaimed: number, permanentFailed: number) {
  console.log(
    JSON.stringify({
      type: "workflow_sweep",
      tick_id: tickId,
      reclaimed,
      permanent_failed: permanentFailed,
      timestamp: new Date().toISOString(),
    }),
  );
}

function logTickError(tickId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      type: "workflow_sweep_error",
      tick_id: tickId,
      error: message,
      stack,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function startWorkflowSweeper(options: SweeperOptions = {}): SweeperHandle {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const stuckThresholdMs = options.stuckThresholdMs ?? DEFAULT_STUCK_THRESHOLD_MS;
  const stuckThresholdSeconds = Math.floor(stuckThresholdMs / 1000);

  let timer: NodeJS.Timeout | null = null;

  async function tick(): Promise<{ reclaimed: number; permanentFailed: number }> {
    const tickId = Math.random().toString(36).slice(2, 10);
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Permanent-fail rows at reclaim limit (SQL computes NOW() - interval each call).
        const permanentFailed = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "workflow_queue"
          SET status = 'FAILED'::"WorkflowQueueStatus",
              error = 'reclaim_limit_exceeded',
              claimed_at = NULL,
              claimed_by = NULL,
              updated_at = NOW()
          WHERE status = 'IN_PROGRESS'::"WorkflowQueueStatus"
            AND claimed_at < NOW() - (${stuckThresholdSeconds}::integer * INTERVAL '1 second')
            AND reclaim_count >= max_reclaim_count
          RETURNING id;
        `;

        // Reclaim remaining stuck rows back to QUEUED and bump reclaim_count.
        const reclaimed = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "workflow_queue"
          SET status = 'QUEUED'::"WorkflowQueueStatus",
              claimed_at = NULL,
              claimed_by = NULL,
              reclaim_count = reclaim_count + 1,
              updated_at = NOW()
          WHERE status = 'IN_PROGRESS'::"WorkflowQueueStatus"
            AND claimed_at < NOW() - (${stuckThresholdSeconds}::integer * INTERVAL '1 second')
            AND reclaim_count < max_reclaim_count
          RETURNING id;
        `;

        return { permanentFailed, reclaimed };
      });

      for (const row of result.reclaimed) {
        await logAudit(null, "workflow.reclaim", "WorkflowQueue", row.id, {
          actor: "sweeper",
          tick_id: tickId,
        });
      }
      for (const row of result.permanentFailed) {
        await logAudit(null, "workflow.reclaim_limit", "WorkflowQueue", row.id, {
          actor: "sweeper",
          tick_id: tickId,
        });
      }

      const reclaimedCount = result.reclaimed.length;
      const permanentFailedCount = result.permanentFailed.length;
      heartbeat(tickId, reclaimedCount, permanentFailedCount);
      return { reclaimed: reclaimedCount, permanentFailed: permanentFailedCount };
    } catch (err) {
      logTickError(tickId, err);
      return { reclaimed: 0, permanentFailed: 0 };
    }
  }

  async function releaseInFlight(claimedBy: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "workflow_queue"
      SET status = 'QUEUED'::"WorkflowQueueStatus",
          claimed_at = NULL,
          claimed_by = NULL,
          updated_at = NOW()
      WHERE status = 'IN_PROGRESS'::"WorkflowQueueStatus"
        AND claimed_by = ${claimedBy}
      RETURNING id;
    `;
    return rows.length;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  timer = setInterval(() => {
    tick().catch((err) => logTickError("interval", err));
  }, intervalMs);
  // Don't block process exit on the interval
  timer.unref?.();

  return { tick, stop, releaseInFlight };
}
