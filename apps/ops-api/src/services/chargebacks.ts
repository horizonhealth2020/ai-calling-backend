import { prisma } from "@ops/db";

export async function matchChargebacksToSales(memberIds: string[]) {
  const uniqueIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, any[]>();

  // Phase 47 WR-04: include full product + payrollEntries so the preview endpoint
  // can surface per-product commission (not premium) for the chargeback total.
  const sales = await prisma.sale.findMany({
    where: { memberId: { in: uniqueIds } },
    include: {
      agent: { select: { id: true, name: true } },
      product: true,
      addons: { include: { product: true } },
      payrollEntries: { orderBy: { createdAt: "asc" } },
      acaCoveredSales: { where: { product: { type: "ACA_PL" } }, select: { id: true } },
    },
  });

  const salesByMemberId = new Map<string, typeof sales>();
  for (const sale of sales) {
    const key = sale.memberId || "";
    if (!salesByMemberId.has(key)) salesByMemberId.set(key, []);
    salesByMemberId.get(key)!.push(sale);
  }
  return salesByMemberId;
}
