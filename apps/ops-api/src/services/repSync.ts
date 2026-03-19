import { prisma } from "@ops/db";
import { logAudit } from "./audit";

/**
 * Create a rep synced in both CsRepRoster and ServiceAgent tables.
 * Uses a transaction to ensure both records are created atomically.
 */
export async function createSyncedRep(name: string, basePay: number = 0, userId: string) {
  return prisma.$transaction(async (tx) => {
    const serviceAgent = await tx.serviceAgent.create({
      data: { name, basePay },
    });

    const csRep = await tx.csRepRoster.create({
      data: { name, serviceAgentId: serviceAgent.id },
    });

    await logAudit(userId, "CREATE", "SyncedRep", serviceAgent.id, {
      serviceAgentId: serviceAgent.id,
      csRepId: csRep.id,
      name,
    });

    return { serviceAgent, csRep };
  });
}

/**
 * Ensure every ServiceAgent has a corresponding CsRepRoster entry.
 * For each ServiceAgent that has no linked CsRepRoster row, create one.
 * This is the primary sync path: payroll adds ServiceAgents, CS dashboard
 * calls this on load to pull them all into the roster automatically.
 */
export async function syncServiceAgentsToCsRoster(): Promise<{ created: number }> {
  const allServiceAgents = await prisma.serviceAgent.findMany({
    include: { csRepRoster: true },
  });
  const unlinked = allServiceAgents.filter((sa) => !sa.csRepRoster);

  let created = 0;
  for (const sa of unlinked) {
    await prisma.csRepRoster.create({
      data: { name: sa.name, serviceAgentId: sa.id },
    });
    created++;
  }
  return { created };
}

/**
 * Sync existing unlinked reps -- find CsRepRoster entries without serviceAgentId
 * and ServiceAgent entries without a linked CsRepRoster, match by name.
 */
export async function syncExistingReps() {
  const unlinkedCsReps = await prisma.csRepRoster.findMany({
    where: { serviceAgentId: null },
  });
  const allServiceAgents = await prisma.serviceAgent.findMany({
    include: { csRepRoster: true },
  });
  const unlinkedServiceAgents = allServiceAgents.filter((sa) => !sa.csRepRoster);

  let linked = 0;
  for (const csRep of unlinkedCsReps) {
    const match = unlinkedServiceAgents.find(
      (sa) => sa.name.toLowerCase().trim() === csRep.name.toLowerCase().trim()
    );
    if (match) {
      await prisma.csRepRoster.update({
        where: { id: csRep.id },
        data: { serviceAgentId: match.id },
      });
      linked++;
    }
  }
  return { linked };
}

/**
 * Round robin: get the next rep to assign to.
 * Uses SalesBoardSetting key "cs_round_robin_index" to persist state.
 */
export async function getNextRoundRobinRep(): Promise<{ id: string; name: string } | null> {
  const activeReps = await prisma.csRepRoster.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  if (activeReps.length === 0) return null;

  return prisma.$transaction(async (tx) => {
    const setting = await tx.salesBoardSetting.findUnique({
      where: { key: "cs_round_robin_index" },
    });
    const currentIndex = setting ? parseInt(setting.value, 10) : 0;
    const safeIndex = currentIndex % activeReps.length;
    const nextIndex = (safeIndex + 1) % activeReps.length;

    await tx.salesBoardSetting.upsert({
      where: { key: "cs_round_robin_index" },
      update: { value: String(nextIndex) },
      create: { key: "cs_round_robin_index", value: String(nextIndex) },
    });

    return { id: activeReps[safeIndex].id, name: activeReps[safeIndex].name };
  });
}

/**
 * Get per-rep checklist: assigned chargebacks + pending terms with resolution status.
 */
export async function getRepChecklist() {
  const reps = await prisma.csRepRoster.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    reps.map(async (rep) => {
      const chargebacks = await prisma.chargebackSubmission.findMany({
        where: { assignedTo: rep.name },
        select: {
          id: true,
          memberCompany: true,
          chargebackAmount: true,
          resolvedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      const pendingTerms = await prisma.pendingTerm.findMany({
        where: { assignedTo: rep.name },
        select: {
          id: true,
          memberName: true,
          enrollAmount: true,
          resolvedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const totalAssigned = chargebacks.length + pendingTerms.length;
      const totalCompleted =
        chargebacks.filter((c) => c.resolvedAt).length +
        pendingTerms.filter((p) => p.resolvedAt).length;

      return {
        rep: { id: rep.id, name: rep.name },
        chargebacks: chargebacks.map((c) => ({
          id: c.id,
          type: "chargeback" as const,
          label: c.memberCompany || "Unknown",
          amount: c.chargebackAmount,
          completed: !!c.resolvedAt,
          createdAt: c.createdAt,
        })),
        pendingTerms: pendingTerms.map((p) => ({
          id: p.id,
          type: "pending_term" as const,
          label: p.memberName || "Unknown",
          amount: p.enrollAmount,
          completed: !!p.resolvedAt,
          createdAt: p.createdAt,
        })),
        totalAssigned,
        totalCompleted,
        completionPct:
          totalAssigned > 0
            ? Math.round((totalCompleted / totalAssigned) * 100)
            : 100,
      };
    })
  );

  return results;
}
