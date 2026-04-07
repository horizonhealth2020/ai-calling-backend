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

/**
 * Reverse a previously-executed carryover when a period is unlocked.
 * - Finds all next-period adjustments that originated from this source period
 * - Subtracts each row's stored carryoverAmount from holdAmount (deterministic, no recomputation)
 * - Clears carryover metadata when no hold remains; keeps partial when other sources contributed
 * - Resets source period's carryoverExecuted so re-lock can carry the edited amount
 * Transactional so partial failures cannot leave the next period in a stale state.
 */
export async function reverseCarryover(sourcePeriodId: string): Promise<{ reversed: number; rowsTouched: number }> {
  return prisma.$transaction(async (tx) => {
    const source = await tx.payrollPeriod.findUnique({ where: { id: sourcePeriodId } });
    if (!source || !source.carryoverExecuted) {
      return { reversed: 0, rowsTouched: 0 };
    }

    const targets = await tx.agentPeriodAdjustment.findMany({
      where: {
        carryoverSourcePeriodId: sourcePeriodId,
        holdFromCarryover: true,
      },
    });

    let totalReversed = 0;
    for (const row of targets) {
      const carriedAmount = Number(row.carryoverAmount ?? 0);
      if (carriedAmount <= 0) continue;

      const currentHold = Number(row.holdAmount);
      const newHold = Math.max(0, currentHold - carriedAmount);
      totalReversed += carriedAmount;

      if (newHold === 0) {
        // Row's hold came solely from carryover -- clear all carryover metadata.
        await tx.agentPeriodAdjustment.update({
          where: { id: row.id },
          data: {
            holdAmount: 0,
            holdFromCarryover: false,
            holdLabel: null,
            carryoverSourcePeriodId: null,
            carryoverAmount: null,
          },
        });
      } else {
        // Partial reversal -- hold had other contributions; keep metadata but clear carryoverAmount.
        await tx.agentPeriodAdjustment.update({
          where: { id: row.id },
          data: {
            holdAmount: newHold,
            carryoverAmount: null,
          },
        });
      }
    }

    // Reset the source period so re-lock can carryover again from a clean slate.
    await tx.payrollPeriod.update({
      where: { id: sourcePeriodId },
      data: { carryoverExecuted: false },
    });

    return { reversed: totalReversed, rowsTouched: targets.length };
  });
}
