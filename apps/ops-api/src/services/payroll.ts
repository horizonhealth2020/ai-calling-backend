import { prisma } from "@ops/db";
import type { Product, Sale, SaleAddon } from "@prisma/client";
import { DateTime } from 'luxon';

const TIMEZONE = 'America/New_York';

export const getSundayWeekRange = (date: Date, shiftWeeks: number = 0) => {
  // Convert UTC date to Eastern time to determine the correct day-of-week
  const eastern = DateTime.fromJSDate(date, { zone: TIMEZONE });

  // Luxon weekday: 1=Mon...7=Sun. Calculate days since Sunday.
  const daysSinceSunday = eastern.weekday === 7 ? 0 : eastern.weekday;

  // Find the Sunday that starts the week containing this date
  const sunday = eastern.minus({ days: daysSinceSunday }).startOf('day');

  // Apply ACH shift if needed
  const shiftedSunday = shiftWeeks > 0 ? sunday.plus({ weeks: shiftWeeks }) : sunday;
  const saturday = shiftedSunday.plus({ days: 6 });

  // Store as UTC midnight dates (preserves existing period ID format)
  const weekStart = new Date(Date.UTC(
    shiftedSunday.year, shiftedSunday.month - 1, shiftedSunday.day
  ));
  const weekEnd = new Date(Date.UTC(
    saturday.year, saturday.month - 1, saturday.day
  ));

  return { weekStart, weekEnd };
};

type SaleWithProduct = Sale & { product: Product; addons: (SaleAddon & { product: Product })[] };

/**
 * Apply enrollment fee rules:
 *   $125 -> +$10 bonus
 *   $99  -> $0
 *   <$99 (or <$50 for standalone addon) -> halve commission, unless approved
 */
function applyEnrollmentFee(commission: number, enrollmentFee: number | null, commissionApproved: boolean, hasCoreInSale: boolean, product: Product): { finalCommission: number; enrollmentBonus: number } {
  if (enrollmentFee === null || enrollmentFee === undefined) {
    return { finalCommission: commission, enrollmentBonus: 0 };
  }

  const fee = Number(enrollmentFee);
  let enrollmentBonus = 0;

  if (fee >= 125) {
    enrollmentBonus = 10;
  }

  // Determine the threshold for halving commission
  // Core/AD&D sales: $99 threshold
  // Standalone addon sales (no core): use product's enrollFeeThreshold if set, else $50
  let halfThreshold: number;
  if (hasCoreInSale) {
    halfThreshold = 99;
  } else if (product.enrollFeeThreshold !== null && product.enrollFeeThreshold !== undefined) {
    halfThreshold = Number(product.enrollFeeThreshold);
  } else {
    halfThreshold = 50;
  }

  if (fee < halfThreshold && !commissionApproved) {
    return { finalCommission: commission / 2, enrollmentBonus };
  }

  return { finalCommission: commission, enrollmentBonus };
}

/**
 * Calculate commission for a sale using bundle aggregation logic.
 *
 * When a core product exists:
 *   1. Sum bundle premium = core premium + regular addon premiums (exclude qualifier premiums)
 *   2. Apply core product's rate (above/below threshold) to the combined bundle premium
 *   3. Calculate AD&D commission separately using bundledCommission rate
 *   4. If no bundle qualifier (isBundleQualifier) and not commissionApproved: halve entire total
 *
 * When no core (standalone):
 *   - Each product uses its standaloneCommission rate x its own premium
 *
 * Null commission rates produce $0 (no hardcoded fallbacks).
 * Final result rounded to 2 decimal places.
 */
export const calculateCommission = (sale: SaleWithProduct): number => {
  const addons = sale.addons ?? [];

  // Build product entries with their respective premiums
  const allEntries = [
    { product: sale.product, premium: Number(sale.premium) },
    ...addons.map(a => ({ product: a.product, premium: Number(a.premium ?? 0) })),
  ];

  // Classify products
  const coreEntry = allEntries.find(e => e.product.type === "CORE");
  const hasCoreInSale = !!coreEntry;
  const qualifierExists = allEntries.some(e => e.product.isBundleQualifier);

  let totalCommission = 0;

  if (hasCoreInSale) {
    // --- CORE + ADDON BUNDLE ---
    // Sum premiums: core + non-qualifier addons (exclude qualifier premiums like Compass VAB)
    const bundlePremium = allEntries
      .filter(e => (e.product.type === "CORE" || e.product.type === "ADDON") && !e.product.isBundleQualifier)
      .reduce((sum, e) => sum + e.premium, 0);

    // Apply core product's rate based on threshold
    const threshold = Number(coreEntry.product.premiumThreshold ?? 0);
    const aboveRate = coreEntry.product.commissionAbove;
    const belowRate = coreEntry.product.commissionBelow;

    if (bundlePremium >= threshold) {
      if (aboveRate === null) {
        console.warn(`Product ${coreEntry.product.id} has null commissionAbove rate`);
      }
      const rate = Number(aboveRate ?? 0);
      totalCommission += bundlePremium * (rate / 100);
    } else {
      if (belowRate === null) {
        console.warn(`Product ${coreEntry.product.id} has null commissionBelow rate`);
      }
      const rate = Number(belowRate ?? 0);
      totalCommission += bundlePremium * (rate / 100);
    }

    // --- AD&D (separate calculation, bundled rate) ---
    for (const entry of allEntries.filter(e => e.product.type === "AD_D")) {
      if (entry.product.bundledCommission === null) {
        console.warn(`Product ${entry.product.id} has null bundledCommission rate`);
      }
      const addDRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addDRate / 100);
    }

    // --- COMPASS VAB HALVING ---
    // If no bundle qualifier present and not manually approved: halve entire sale commission
    if (!qualifierExists && !sale.commissionApproved) {
      totalCommission /= 2;
    }
  } else {
    // --- STANDALONE (no core product) ---
    for (const entry of allEntries) {
      if (entry.product.type === "AD_D" || entry.product.type === "ADDON") {
        if (entry.product.standaloneCommission === null) {
          console.warn(`Product ${entry.product.id} has null standaloneCommission rate`);
        }
        const rate = Number(entry.product.standaloneCommission ?? 0);
        totalCommission += entry.premium * (rate / 100);
      }
    }
  }

  // Apply enrollment fee rules (Phase 3 scope -- do not modify applyEnrollmentFee)
  const { finalCommission, enrollmentBonus } = applyEnrollmentFee(
    totalCommission,
    sale.enrollmentFee !== null ? Number(sale.enrollmentFee) : null,
    sale.commissionApproved,
    hasCoreInSale,
    sale.product,
  );

  return Math.round((finalCommission + enrollmentBonus) * 100) / 100;
};

/**
 * Zero out commission for a sale across all payroll entries.
 * - OPEN periods: zero out (payoutAmount=0, netAmount=0, status=ZEROED_OUT)
 * - Finalized/paid periods: apply clawback (negative adjustment, status=CLAWBACK_APPLIED)
 */
export const handleCommissionZeroing = async (saleId: string) => {
  const entries = await prisma.payrollEntry.findMany({
    where: { saleId },
    include: { payrollPeriod: true },
  });

  for (const entry of entries) {
    if (entry.payrollPeriod.status === 'OPEN') {
      await prisma.payrollEntry.update({
        where: { id: entry.id },
        data: { payoutAmount: 0, netAmount: 0, status: 'ZEROED_OUT' },
      });
    } else {
      // Finalized/locked/paid: apply clawback pattern (mirrors clawback logic in routes)
      await prisma.payrollEntry.update({
        where: { id: entry.id },
        data: {
          adjustmentAmount: Number(entry.adjustmentAmount) - Number(entry.netAmount),
          status: 'CLAWBACK_APPLIED',
        },
      });
    }
  }
};

export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: true, addons: { include: { product: true } } },
  });
  if (!sale) throw new Error("Sale not found");

  const payoutAmount = sale.status === 'RAN' ? calculateCommission(sale) : 0;
  const shiftWeeks = sale.paymentType === 'ACH' ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(sale.saleDate, shiftWeeks);

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

  // Check if an existing entry has bonus/fronted/hold to preserve those values
  const existing = await prisma.payrollEntry.findUnique({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
  });
  const bonus = existing ? Number(existing.bonusAmount) : 0;
  const fronted = existing ? Number(existing.frontedAmount) : 0;
  const hold = existing ? Number(existing.holdAmount) : 0;
  const adjustment = existing ? Number(existing.adjustmentAmount) : 0;
  const netAmount = payoutAmount + adjustment + bonus - fronted - hold;

  return prisma.payrollEntry.upsert({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
    create: {
      payrollPeriodId: period.id,
      saleId,
      agentId: sale.agentId,
      payoutAmount,
      netAmount: payoutAmount,
    },
    update: { payoutAmount, netAmount },
  });
};
