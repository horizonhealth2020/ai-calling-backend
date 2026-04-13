/**
 * One-time cleanup script: finds and removes orphaned Clawback/PayrollEntry
 * records left behind by the broken chargeback delete flow (fixed in commit 27c5335).
 *
 * Run: npx tsx prisma/scripts/cleanup-orphaned-clawbacks.ts
 * Idempotent: safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Orphaned Clawback Cleanup ===\n");

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
    return;
  }

  console.log(`Found ${orphanedClawbacks.length} orphaned Clawback(s):\n`);

  const affectedSaleIds = new Set<string>();
  let clawbacksDeleted = 0;
  let entriesDeleted = 0;

  for (const clawback of orphanedClawbacks) {
    // 4. Log full record before deletion (audit trail)
    console.log("PRE-DELETE RECORD:", JSON.stringify({
      id: clawback.id,
      saleId: clawback.saleId,
      agentId: clawback.agentId,
      agentName: clawback.agent?.name,
      amount: Number(clawback.amount),
      status: clawback.status,
      notes: clawback.notes,
      createdAt: clawback.createdAt.toISOString(),
    }));

    // 5. Atomic deletion per clawback (transaction)
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Delete ClawbackProducts for this clawback
        const prodResult = await tx.clawbackProduct.deleteMany({
          where: { clawbackId: clawback.id },
        });

        // Delete the Clawback itself
        await tx.clawback.delete({ where: { id: clawback.id } });

        // Delete orphaned PayrollEntries for this sale with clawback statuses
        const entryResult = await tx.payrollEntry.deleteMany({
          where: {
            saleId: clawback.saleId,
            status: { in: ["ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
          },
        });

        return { productsDeleted: prodResult.count, entriesDeleted: entryResult.count };
      });

      clawbacksDeleted++;
      entriesDeleted += result.entriesDeleted;
      affectedSaleIds.add(clawback.saleId);

      console.log(`  DELETED: Clawback ${clawback.id} (${result.productsDeleted} products, ${result.entriesDeleted} entries)\n`);
    } catch (err) {
      console.error(`  ERROR processing Clawback ${clawback.id}:`, err);
      // Continue with remaining clawbacks
    }
  }

  // 6. Check for any remaining orphaned PayrollEntries (not linked to a specific clawback but stale)
  const remainingOrphans = await prisma.payrollEntry.findMany({
    where: {
      status: { in: ["ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
      sale: { clawbacks: { none: {} } },
    },
    select: { id: true, saleId: true, status: true, payoutAmount: true, adjustmentAmount: true },
  });

  if (remainingOrphans.length > 0) {
    console.log(`\nFound ${remainingOrphans.length} additional orphaned PayrollEntry(s) with no Clawback:\n`);
    for (const entry of remainingOrphans) {
      console.log("PRE-DELETE ENTRY:", JSON.stringify(entry));
      try {
        await prisma.payrollEntry.delete({ where: { id: entry.id } });
        entriesDeleted++;
        affectedSaleIds.add(entry.saleId);
        console.log(`  DELETED: PayrollEntry ${entry.id}`);
      } catch (err) {
        console.error(`  ERROR deleting PayrollEntry ${entry.id}:`, err);
      }
    }
  }

  // 7. Summary
  console.log("\n=== Cleanup Summary ===");
  console.log(`Clawbacks deleted: ${clawbacksDeleted}`);
  console.log(`PayrollEntries deleted: ${entriesDeleted}`);
  console.log(`Sales affected: ${affectedSaleIds.size}`);
  console.log(`Affected saleIds: ${[...affectedSaleIds].join(", ")}`);
  console.log("\nNote: Commission will be recalculated automatically on the next payroll action for each affected sale.");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
