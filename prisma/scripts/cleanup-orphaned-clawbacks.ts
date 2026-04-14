/**
 * One-time cleanup script: finds and removes orphaned Clawback/PayrollEntry
 * records left behind by the broken chargeback delete flow (fixed in commit 27c5335).
 *
 * Default: DRY-RUN (no mutations). Pass --execute to perform real deletions.
 *
 *   npx tsx prisma/scripts/cleanup-orphaned-clawbacks.ts              # dry-run (default)
 *   npx tsx prisma/scripts/cleanup-orphaned-clawbacks.ts --dry-run    # explicit dry-run
 *   npx tsx prisma/scripts/cleanup-orphaned-clawbacks.ts --execute    # real deletion
 *
 * Idempotent: safe to run multiple times.
 * Writes JSON audit log to prisma/scripts/logs/ (gitignored).
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

// ── Flag parsing — safety-first default ─────────────────────────────
const args = process.argv.slice(2);
const wantsExecute = args.includes("--execute");
const wantsDryRun = args.includes("--dry-run") || args.includes("-n");

if (wantsExecute && wantsDryRun) {
  console.error("Error: --dry-run and --execute are mutually exclusive");
  process.exit(2);
}

const isDryRun = !wantsExecute;

if (isDryRun && !wantsDryRun) {
  console.log("No --execute flag — running in dry-run mode by default.");
  console.log("Pass --execute to perform real deletions.\n");
}

// ── Environment marker (sanity check — catch wrong-target-DB accidents) ──
try {
  const parsed = new URL(process.env.DATABASE_URL ?? "");
  console.error(`Target DB: ${parsed.host}${parsed.pathname}`);
} catch {
  console.error("Target DB: <could not parse DATABASE_URL>");
}
console.log();

// ── JSON audit log setup ─────────────────────────────────────────────
const logsDir = path.join(process.cwd(), "prisma", "scripts", "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logTs = new Date().toISOString().replace(/[:.]/g, "-");
const logFile = path.join(logsDir, `cleanup-${isDryRun ? "dry-run" : "real-run"}-${logTs}.json`);

type LogEntry =
  | { kind: "clawback"; id: string; saleId: string; agentId: string; agentName: string | null; amount: number; status: string; notes: string | null; createdAt: string; deleted: boolean; productsDeleted?: number; entriesDeleted?: number; error?: string }
  | { kind: "payroll_entry"; id: string; saleId: string; status: string; payoutAmount: number; adjustmentAmount: number; deleted: boolean; error?: string };

const logPayload: LogEntry[] = [];

async function main() {
  const header = isDryRun ? "(DRY RUN — NO MUTATIONS)" : "(EXECUTE — REAL DELETIONS)";
  console.log(`=== Orphaned Clawback Cleanup ${header} ===\n`);

  const prefix = isDryRun ? "[DRY-RUN] " : "";

  // 1. Get all distinct saleIds that still have a ChargebackSubmission referencing them
  const activeSubs = await prisma.chargebackSubmission.findMany({
    where: { matchedSaleId: { not: null } },
    select: { matchedSaleId: true },
  });
  const activeSaleIds = new Set(activeSubs.map((s) => s.matchedSaleId!));

  // 2. Find all Clawback records
  const allClawbacks = await prisma.clawback.findMany({
    include: { agent: { select: { name: true } } },
  });

  // 3. Identify orphans: clawback.saleId not in any ChargebackSubmission.matchedSaleId
  const orphanedClawbacks = allClawbacks.filter((c) => !activeSaleIds.has(c.saleId));

  if (orphanedClawbacks.length === 0) {
    console.log("No orphaned records found — database is clean.");
    fs.writeFileSync(logFile, JSON.stringify(logPayload, null, 2));
    console.log(`\nJSON log: ${logFile}`);
    return;
  }

  console.log(`Found ${orphanedClawbacks.length} orphaned Clawback(s):\n`);

  const affectedSaleIds = new Set<string>();
  let clawbacksProcessed = 0;
  let entriesProcessed = 0;

  for (const clawback of orphanedClawbacks) {
    const baseEntry = {
      kind: "clawback" as const,
      id: clawback.id,
      saleId: clawback.saleId,
      agentId: clawback.agentId,
      agentName: clawback.agent?.name ?? null,
      amount: Number(clawback.amount),
      status: clawback.status,
      notes: clawback.notes,
      createdAt: clawback.createdAt.toISOString(),
    };

    // 4. Log full record before any deletion (audit trail)
    console.log(`${prefix}PRE-DELETE RECORD:`, JSON.stringify(baseEntry));

    if (isDryRun) {
      // Dry-run: count and log, do NOT mutate
      clawbacksProcessed++;
      affectedSaleIds.add(clawback.saleId);

      // Count what WOULD be deleted for entries
      const wouldDeleteEntries = await prisma.payrollEntry.count({
        where: {
          saleId: clawback.saleId,
          status: { in: ["ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
        },
      });
      entriesProcessed += wouldDeleteEntries;

      logPayload.push({ ...baseEntry, deleted: false, entriesDeleted: wouldDeleteEntries });
      console.log(`${prefix}WOULD DELETE: Clawback ${clawback.id} (${wouldDeleteEntries} entries would be cleared)\n`);
      continue;
    }

    // 5. Atomic deletion per clawback (transaction) — real run only
    try {
      const result = await prisma.$transaction(async (tx) => {
        const prodResult = await tx.clawbackProduct.deleteMany({
          where: { clawbackId: clawback.id },
        });
        await tx.clawback.delete({ where: { id: clawback.id } });
        const entryResult = await tx.payrollEntry.deleteMany({
          where: {
            saleId: clawback.saleId,
            status: { in: ["ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
          },
        });
        return { productsDeleted: prodResult.count, entriesDeleted: entryResult.count };
      });

      clawbacksProcessed++;
      entriesProcessed += result.entriesDeleted;
      affectedSaleIds.add(clawback.saleId);

      logPayload.push({ ...baseEntry, deleted: true, productsDeleted: result.productsDeleted, entriesDeleted: result.entriesDeleted });
      console.log(`  DELETED: Clawback ${clawback.id} (${result.productsDeleted} products, ${result.entriesDeleted} entries)\n`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logPayload.push({ ...baseEntry, deleted: false, error: errMsg });
      console.error(`  ERROR processing Clawback ${clawback.id}:`, err);
      // Continue with remaining clawbacks
    }
  }

  // 6. Check for remaining orphaned PayrollEntries (not linked to any clawback)
  const remainingOrphans = await prisma.payrollEntry.findMany({
    where: {
      status: { in: ["ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
      sale: { clawbacks: { none: {} } },
    },
    select: { id: true, saleId: true, status: true, payoutAmount: true, adjustmentAmount: true },
  });

  if (remainingOrphans.length > 0) {
    console.log(`\n${prefix}Found ${remainingOrphans.length} additional orphaned PayrollEntry(s) with no Clawback:\n`);
    for (const entry of remainingOrphans) {
      const baseEntry = {
        kind: "payroll_entry" as const,
        id: entry.id,
        saleId: entry.saleId,
        status: entry.status ?? "unknown",
        payoutAmount: Number(entry.payoutAmount),
        adjustmentAmount: Number(entry.adjustmentAmount),
      };
      console.log(`${prefix}PRE-DELETE ENTRY:`, JSON.stringify(baseEntry));

      if (isDryRun) {
        entriesProcessed++;
        affectedSaleIds.add(entry.saleId);
        logPayload.push({ ...baseEntry, deleted: false });
        console.log(`${prefix}WOULD DELETE: PayrollEntry ${entry.id}\n`);
        continue;
      }

      try {
        await prisma.payrollEntry.delete({ where: { id: entry.id } });
        entriesProcessed++;
        affectedSaleIds.add(entry.saleId);
        logPayload.push({ ...baseEntry, deleted: true });
        console.log(`  DELETED: PayrollEntry ${entry.id}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logPayload.push({ ...baseEntry, deleted: false, error: errMsg });
        console.error(`  ERROR deleting PayrollEntry ${entry.id}:`, err);
      }
    }
  }

  // 7. Summary
  const verb = isDryRun ? "would delete" : "deleted";
  console.log("\n=== Cleanup Summary ===");
  if (isDryRun) console.log("Mode: DRY-RUN (no mutations performed)");
  console.log(`Clawbacks ${verb}: ${clawbacksProcessed}`);
  console.log(`PayrollEntries ${verb}: ${entriesProcessed}`);
  console.log(`Sales affected: ${affectedSaleIds.size}`);
  console.log(`Affected saleIds: ${[...affectedSaleIds].join(", ")}`);
  if (!isDryRun) {
    console.log("\nNote: Commission will be recalculated automatically on the next payroll action for each affected sale.");
  }

  // 8. Write JSON audit log
  fs.writeFileSync(logFile, JSON.stringify(logPayload, null, 2));
  console.log(`\nJSON log: ${logFile}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
