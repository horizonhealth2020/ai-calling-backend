import { prisma } from "@ops/db";

export const getSundayWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
  return { weekStart, weekEnd };
};

export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw new Error("Sale not found");
  const payoutRule = await prisma.payoutRule.findFirst({
    where: { productId: sale.productId, active: true, effectiveDate: { lte: sale.saleDate } },
    orderBy: { effectiveDate: "desc" },
  });
  const payoutAmount = payoutRule?.payoutAmount ?? 0;
  const { weekStart, weekEnd } = getSundayWeekRange(sale.saleDate);

  const period = await prisma.payrollPeriod.upsert({
    where: { id: `${weekStart.toISOString()}_${weekEnd.toISOString()}` },
    create: {
      id: `${weekStart.toISOString()}_${weekEnd.toISOString()}`,
      weekStart,
      weekEnd,
      quarterLabel: `Q${Math.floor(weekStart.getUTCMonth() / 3) + 1}`,
      year: weekStart.getUTCFullYear(),
    },
    update: {},
  });

  return prisma.payrollEntry.upsert({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
    create: {
      payrollPeriodId: period.id,
      saleId,
      agentId: sale.agentId,
      payoutAmount,
      netAmount: payoutAmount,
    },
    update: { payoutAmount, netAmount: payoutAmount },
  });
};
