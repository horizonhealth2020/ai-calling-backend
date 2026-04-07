import { prisma } from "@ops/db";
import { getSundayWeekRange } from "./payroll";

/**
 * Execute carryover logic when a payroll period is locked.
 * - Fronted amount carries as hold in the next period (D-09)
 * - If agent net is negative, the unpaid portion carries as hold (D-10)
 * - Carryover amounts ADD to existing values via increment (D-11, CARRY-07)
 * - Idempotent: skips if carryoverExecuted is already true (D-14, CARRY-06)
 */
export async function executeCarryover(periodId: string): Promise<{ carried: number; skipped: boolean }> {
  // 1. Load period with agentAdjustments and entries
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { agentAdjustments: true, entries: true },
  });
  if (!period) throw new Error("Period not found");

  // CARRY-06: idempotency -- skip if already executed
  if (period.carryoverExecuted) return { carried: 0, skipped: true };

  // Calculate next period dates using getSundayWeekRange
  const nextDay = new Date(period.weekEnd.getTime() + 86400000);
  const { weekStart, weekEnd } = getSundayWeekRange(nextDay);
  const nextPeriodId = `${weekStart.toISOString()}_${weekEnd.toISOString()}`;

  // Ensure next period exists
  await prisma.payrollPeriod.upsert({
    where: { id: nextPeriodId },
    create: {
      id: nextPeriodId,
      weekStart,
      weekEnd,
      quarterLabel: `Q${Math.floor(weekStart.getUTCMonth() / 3) + 1}`,
      year: weekStart.getUTCFullYear(),
    },
    update: {},
  });

  let carried = 0;

  for (const adj of period.agentAdjustments) {
    const agentEntries = (period as any).entries.filter((e: any) => e.agentId === adj.agentId);
    const totalPayout = agentEntries.reduce((s: number, e: any) => s + Number(e.payoutAmount), 0);
    const totalAdj = agentEntries.reduce((s: number, e: any) => s + Number(e.adjustmentAmount), 0);
    // Net formula: payout + adjustment + bonus + fronted - hold (per NET-01)
    const agentNet = totalPayout + totalAdj + Number(adj.bonusAmount) + Number(adj.frontedAmount) - Number(adj.holdAmount);

    let carryHold = 0;

    // D-09: Fronted carries as hold
    carryHold += Number(adj.frontedAmount);

    // D-10: Negative net carries as hold (unpaid portion)
    if (agentNet < 0) {
      carryHold += Math.abs(agentNet);
    }

    if (carryHold <= 0) continue;

    // D-11 + D-14: Upsert with increment (CARRY-07 + CARRY-06)
    await prisma.agentPeriodAdjustment.upsert({
      where: { agentId_payrollPeriodId: { agentId: adj.agentId, payrollPeriodId: nextPeriodId } },
      create: {
        agentId: adj.agentId,
        payrollPeriodId: nextPeriodId,
        holdAmount: carryHold,
        holdFromCarryover: true,
        holdLabel: "Fronted Hold",
        carryoverSourcePeriodId: periodId,
        carryoverAmount: carryHold,
      },
      update: {
        holdAmount: { increment: carryHold },
        holdFromCarryover: true,
        holdLabel: "Fronted Hold",
        carryoverSourcePeriodId: periodId,
        carryoverAmount: { increment: carryHold },
      },
    });
    carried++;
  }

  // Mark period as carryover-executed
  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: { carryoverExecuted: true },
  });

  return { carried, skipped: false };
}
