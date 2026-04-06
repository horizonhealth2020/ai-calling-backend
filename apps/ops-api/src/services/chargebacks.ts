import { prisma } from "@ops/db";

export async function matchChargebacksToSales(memberIds: string[]) {
  const uniqueIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, any[]>();

  const sales = await prisma.sale.findMany({
    where: { memberId: { in: uniqueIds } },
    include: {
      agent: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true } },
      addons: {
        include: {
          product: { select: { id: true, name: true, type: true } },
        },
      },
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
