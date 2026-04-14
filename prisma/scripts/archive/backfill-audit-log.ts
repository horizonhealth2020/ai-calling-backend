/**
 * One-time backfill script: creates AppAuditLog entries for historical
 * Sale, ChargebackSubmission, and PendingTerm records so the activity
 * feed has data from before the logAudit deploy date.
 *
 * Run: npx tsx prisma/scripts/backfill-audit-log.ts
 * Idempotent: safe to run multiple times (dedup on entityType:entityId).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Activity Feed Backfill ===\n");

  // 1. Build dedup set keyed on entityType:entityId
  const existingLogs = await prisma.appAuditLog.findMany({
    where: { action: "CREATE" },
    select: { entityType: true, entityId: true },
  });
  const existingKeys = new Set(
    existingLogs
      .filter((l) => l.entityId)
      .map((l) => `${l.entityType}:${l.entityId}`),
  );

  console.log(`Existing CREATE audit entries: ${existingKeys.size}\n`);

  let salesBackfilled = 0;
  let chargebacksBackfilled = 0;
  let pendingTermsBackfilled = 0;

  // 2. Backfill Sales
  const sales = await prisma.sale.findMany({
    select: { id: true, createdAt: true, agentId: true, memberName: true, premium: true, status: true },
  });

  for (const sale of sales) {
    if (existingKeys.has(`Sale:${sale.id}`)) continue;
    try {
      await prisma.appAuditLog.create({
        data: {
          actorUserId: null,
          action: "CREATE",
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            memberName: sale.memberName,
            premium: Number(sale.premium),
            status: sale.status,
            backfilled: true,
          },
          createdAt: sale.createdAt,
        },
      });
      salesBackfilled++;
    } catch (err) {
      console.error(`  ERROR backfilling Sale ${sale.id}:`, err);
    }
  }

  if (salesBackfilled > 0) console.log(`Sales backfilled: ${salesBackfilled}`);

  // 3. Backfill ChargebackSubmissions
  const chargebacks = await prisma.chargebackSubmission.findMany({
    select: { id: true, batchId: true, submittedAt: true, memberCompany: true, chargebackAmount: true },
  });

  for (const cb of chargebacks) {
    if (existingKeys.has(`ChargebackSubmission:${cb.id}`)) continue;
    try {
      await prisma.appAuditLog.create({
        data: {
          actorUserId: null,
          action: "CREATE",
          entityType: "ChargebackSubmission",
          entityId: cb.id,
          metadata: {
            batchId: cb.batchId,
            memberCompany: cb.memberCompany,
            chargebackAmount: cb.chargebackAmount ? Number(cb.chargebackAmount) : null,
            backfilled: true,
          },
          createdAt: cb.submittedAt,
        },
      });
      chargebacksBackfilled++;
    } catch (err) {
      console.error(`  ERROR backfilling ChargebackSubmission ${cb.id}:`, err);
    }
  }

  if (chargebacksBackfilled > 0) console.log(`ChargebackSubmissions backfilled: ${chargebacksBackfilled}`);

  // 4. Backfill PendingTerms
  const terms = await prisma.pendingTerm.findMany({
    select: { id: true, batchId: true, submittedAt: true, memberName: true, holdReason: true },
  });

  for (const term of terms) {
    if (existingKeys.has(`PendingTerm:${term.id}`)) continue;
    try {
      await prisma.appAuditLog.create({
        data: {
          actorUserId: null,
          action: "CREATE",
          entityType: "PendingTerm",
          entityId: term.id,
          metadata: {
            batchId: term.batchId,
            memberName: term.memberName,
            holdReason: term.holdReason,
            backfilled: true,
          },
          createdAt: term.submittedAt,
        },
      });
      pendingTermsBackfilled++;
    } catch (err) {
      console.error(`  ERROR backfilling PendingTerm ${term.id}:`, err);
    }
  }

  if (pendingTermsBackfilled > 0) console.log(`PendingTerms backfilled: ${pendingTermsBackfilled}`);

  // 5. Summary
  const total = salesBackfilled + chargebacksBackfilled + pendingTermsBackfilled;
  if (total === 0) {
    console.log("Activity feed already backfilled — nothing to do.");
  } else {
    console.log(`\n=== Backfill Summary ===`);
    console.log(`Sales: ${salesBackfilled}`);
    console.log(`ChargebackSubmissions: ${chargebacksBackfilled}`);
    console.log(`PendingTerms: ${pendingTermsBackfilled}`);
    console.log(`Total entries created: ${total}`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
