import { prisma } from "@ops/db";
import { randomUUID } from "crypto";
import { logAudit } from "./audit";

const BATCH_SIZE = 5000;

const ARCHIVE_TABLES = [
  { main: "call_audits", archive: "call_audits_archive", dateCol: "created_at" },
  { main: "convoso_call_logs", archive: "convoso_call_logs_archive", dateCol: "created_at" },
  { main: "app_audit_log", archive: "app_audit_log_archive", dateCol: "created_at" },
] as const;

type TableName = (typeof ARCHIVE_TABLES)[number]["main"];

// Column lists for each table (used for restore — excludes archived_at and archive_batch_id)
const TABLE_COLUMNS: Record<TableName, string> = {
  call_audits: [
    "id", "agent_id", "call_date", "score", "status", "coaching_notes",
    "reviewer_user_id", "transcription", "ai_summary", "ai_score",
    "ai_coaching_notes", "recording_url", "call_outcome",
    "call_duration_estimate", "issues", "wins", "missed_opportunities",
    "suggested_coaching", "manager_summary", "created_at", "updated_at",
  ].join(", "),
  convoso_call_logs: [
    "id", "agent_user", "list_id", "recording_url", "call_duration_seconds",
    "call_timestamp", "agent_id", "lead_source_id", "transcription",
    "audit_status", "call_audit_id", "created_at",
  ].join(", "),
  app_audit_log: [
    "id", "actor_user_id", "action", "entity_type", "entity_id",
    "metadata", "created_at",
  ].join(", "),
};

/**
 * Preview eligible row counts per table for a given cutoff date (no data modified).
 */
export async function previewArchive(cutoffDate: Date) {
  const tables: { name: string; count: number }[] = [];
  let total = 0;

  for (const t of ARCHIVE_TABLES) {
    const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM ${t.main} WHERE ${t.dateCol} < $1`,
      cutoffDate,
    );
    const count = Number(result[0].count);
    tables.push({ name: t.main, count });
    total += count;
  }

  return { tables, total };
}

/**
 * Archive records older than cutoffDate from selected tables into archive tables.
 * Processes in batches of BATCH_SIZE to avoid long-running transactions.
 * Handles FK safety: nulls call_audit_id on convoso_call_logs before archiving call_audits.
 */
export async function archiveRecords(
  cutoffDate: Date,
  tables: TableName[],
  userId: string,
) {
  const batchId = randomUUID();
  const results: { table: string; count: number }[] = [];

  for (const t of ARCHIVE_TABLES) {
    if (!tables.includes(t.main)) continue;

    // FK safety: null out call_audit_id on convoso_call_logs before archiving call_audits
    if (t.main === "call_audits") {
      await prisma.$executeRawUnsafe(
        `UPDATE convoso_call_logs SET call_audit_id = NULL
         WHERE call_audit_id IN (SELECT id FROM call_audits WHERE created_at < $1)`,
        cutoffDate,
      );
    }

    // Count eligible rows
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM ${t.main} WHERE ${t.dateCol} < $1`,
      cutoffDate,
    );
    const totalCount = Number(countResult[0].count);

    if (totalCount > 0) {
      let archived = 0;
      while (archived < totalCount) {
        // Copy batch to archive table
        await prisma.$executeRawUnsafe(
          `INSERT INTO ${t.archive} (${TABLE_COLUMNS[t.main]}, archived_at, archive_batch_id)
           SELECT ${TABLE_COLUMNS[t.main]}, NOW(), $1
           FROM ${t.main} WHERE ${t.dateCol} < $2
           LIMIT ${BATCH_SIZE}`,
          batchId,
          cutoffDate,
        );

        // Delete the same batch from main table
        await prisma.$executeRawUnsafe(
          `DELETE FROM ${t.main} WHERE id IN (
            SELECT id FROM ${t.main} WHERE ${t.dateCol} < $1 LIMIT ${BATCH_SIZE}
          )`,
          cutoffDate,
        );

        archived += BATCH_SIZE;
      }
    }

    results.push({ table: t.main, count: totalCount });
  }

  await logAudit(userId, "data_archived", "Archive", batchId, {
    tables,
    cutoffDate: cutoffDate.toISOString(),
    results,
  });

  return { batchId, results };
}

/**
 * Restore all records from a given archive batch back to their main tables.
 */
export async function restoreBatch(batchId: string, userId: string) {
  const results: { table: string; count: number }[] = [];

  for (const t of ARCHIVE_TABLES) {
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM ${t.archive} WHERE archive_batch_id = $1`,
      batchId,
    );
    const count = Number(countResult[0].count);

    if (count > 0) {
      // Copy rows back to main table (excluding archived_at and archive_batch_id)
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${t.main} (${TABLE_COLUMNS[t.main]})
         SELECT ${TABLE_COLUMNS[t.main]} FROM ${t.archive}
         WHERE archive_batch_id = $1`,
        batchId,
      );

      // Remove from archive
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${t.archive} WHERE archive_batch_id = $1`,
        batchId,
      );
    }

    results.push({ table: t.main, count });
  }

  await logAudit(userId, "data_restored", "Archive", batchId, { results });

  return { batchId, results };
}

/**
 * Get statistics about archived data: row counts, date ranges, and recent batches.
 */
export async function getArchiveStats() {
  const tables: { name: string; rowCount: number; oldestRecord: string | null; newestRecord: string | null }[] = [];
  const batches: { batchId: string; table: string; count: number; archivedAt: string | null }[] = [];

  for (const t of ARCHIVE_TABLES) {
    // Row count and date range
    const statsResult = await prisma.$queryRawUnsafe<[{ count: bigint; oldest: Date | null; newest: Date | null }]>(
      `SELECT COUNT(*) as count, MIN(created_at) as oldest, MAX(created_at) as newest FROM ${t.archive}`,
    );
    tables.push({
      name: t.main,
      rowCount: Number(statsResult[0].count),
      oldestRecord: statsResult[0].oldest?.toISOString() ?? null,
      newestRecord: statsResult[0].newest?.toISOString() ?? null,
    });

    // Recent batches for this table
    const batchResult = await prisma.$queryRawUnsafe<{ archive_batch_id: string; count: bigint; archived_at: Date }[]>(
      `SELECT archive_batch_id, COUNT(*) as count, MIN(archived_at) as archived_at
       FROM ${t.archive}
       GROUP BY archive_batch_id
       ORDER BY MIN(archived_at) DESC
       LIMIT 20`,
    );
    for (const b of batchResult) {
      batches.push({
        batchId: b.archive_batch_id,
        table: t.main,
        count: Number(b.count),
        archivedAt: b.archived_at?.toISOString() ?? null,
      });
    }
  }

  return { tables, batches };
}
