import { prisma } from "@ops/db";

export async function getAgentRetentionKpis() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all active agents
  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  // Get chargeback aggregates grouped by memberAgentId (free-text field)
  const chargebacks = await prisma.chargebackSubmission.groupBy({
    by: ["memberAgentId"],
    where: {
      submittedAt: { gte: thirtyDaysAgo },
      memberAgentId: { not: null },
    },
    _count: true,
    _sum: { chargebackAmount: true },
  });

  // Get pending term aggregates grouped by agentName
  const pendingTerms = await prisma.pendingTerm.groupBy({
    by: ["agentName"],
    where: {
      submittedAt: { gte: thirtyDaysAgo },
      agentName: { not: null },
    },
    _count: true,
  });

  // Match chargebacks and pending terms to agents by name (case-insensitive)
  const kpis = agents.map((agent) => {
    const agentNameLower = agent.name.toLowerCase().trim();

    const cbMatch = chargebacks.find(
      (cb) => cb.memberAgentId?.toLowerCase().trim() === agentNameLower,
    );
    const ptMatch = pendingTerms.find(
      (pt) => pt.agentName?.toLowerCase().trim() === agentNameLower,
    );

    return {
      agentId: agent.id,
      agentName: agent.name,
      chargebackCount: cbMatch?._count ?? 0,
      chargebackTotal: Number(cbMatch?._sum?.chargebackAmount ?? 0),
      pendingTermCount: ptMatch?._count ?? 0,
    };
  });

  // Totals for StatCard summary row
  const totals = {
    totalChargebackCount: kpis.reduce((sum, k) => sum + k.chargebackCount, 0),
    totalChargebackDollars: kpis.reduce(
      (sum, k) => sum + k.chargebackTotal,
      0,
    ),
    totalPendingTermCount: kpis.reduce(
      (sum, k) => sum + k.pendingTermCount,
      0,
    ),
  };

  return { agents: kpis, totals };
}
