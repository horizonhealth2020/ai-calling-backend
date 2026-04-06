import { prisma } from "@ops/db";
import type { Product, Sale, SaleAddon } from "@prisma/client";
import { DateTime } from 'luxon';

const TIMEZONE = 'America/New_York';

/** Enrollment fee >= this threshold triggers the enrollment bonus */
export const ENROLLMENT_BONUS_THRESHOLD = 125;
/** Dollar amount of the enrollment bonus */
export const ENROLLMENT_BONUS_AMOUNT = 10;

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
 * Bundle requirement context resolved from ProductStateAvailability data.
 * null means no bundle requirement configured on the core product.
 */
export type BundleRequirementContext = {
  requiredAddonAvailable: boolean;
  fallbackAddonAvailable: boolean;
  halvingReason: string | null;
} | null;

/**
 * Apply enrollment fee rules:
 *   $125 -> +$10 bonus
 *   $99  -> $0
 *   <$99 (or <$50 for standalone addon) -> halve commission, unless approved
 */
function applyEnrollmentFee(commission: number, enrollmentFee: number | null, commissionApproved: boolean, hasCoreInSale: boolean, product: Product): { finalCommission: number; enrollmentBonus: number; feeHalvingReason: string | null } {
  if (enrollmentFee === null || enrollmentFee === undefined) {
    return { finalCommission: commission, enrollmentBonus: 0, feeHalvingReason: null };
  }

  const fee = Number(enrollmentFee);
  let enrollmentBonus = 0;

  if (fee >= ENROLLMENT_BONUS_THRESHOLD) {
    enrollmentBonus = ENROLLMENT_BONUS_AMOUNT;
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

  if (fee < halfThreshold) {
    return { finalCommission: commission, enrollmentBonus, feeHalvingReason: `Half commission - waived enrollment fee` };
  }

  return { finalCommission: commission, enrollmentBonus, feeHalvingReason: null };
}

/**
 * Calculate commission for a sale using bundle aggregation logic.
 *
 * When a core product exists:
 *   1. ADDONs with bundledCommission = null: fold premium into bundlePremium, earn core rate.
 *      bundlePremium = core premium + those addon premiums.
 *      Core rate = commissionAbove if bundlePremium >= premiumThreshold, else commissionBelow.
 *   2. ADDONs with bundledCommission set: calculated separately at their own bundledCommission rate.
 *   3. AD&D products always use their own bundledCommission rate (separate calculation).
 *   4. Bundle qualifier halving: if bundleCtx says required/fallback addon missing, commission is halved.
 *
 * When no core (standalone addons only):
 *   - Each ADDON/AD&D uses its standaloneCommission rate x its own premium.
 *
 * Null commission rates produce $0 (no hardcoded fallbacks).
 * Final result rounded to 2 decimal places.
 */
export const calculateCommission = (sale: SaleWithProduct, bundleCtx?: BundleRequirementContext): { commission: number; halvingReason: string | null } => {
  // ACA PL: flat dollar amount per member (not percentage-based)
  if (sale.product.type === "ACA_PL") {
    const flatAmount = Number(sale.product.flatCommission ?? 0);
    const count = (sale as SaleWithProduct & { memberCount?: number | null }).memberCount ?? 1;
    return {
      commission: Math.round(flatAmount * count * 100) / 100,
      halvingReason: null,
    };
  }

  const addons = sale.addons ?? [];
  let halvingReason: string | null = null;

  // Build product entries with their respective premiums
  const allEntries = [
    { product: sale.product, premium: Number(sale.premium) },
    ...addons.map(a => ({ product: a.product, premium: Number(a.premium ?? 0) })),
  ];

  // Classify products
  const coreEntry = allEntries.find(e => e.product.type === "CORE");
  const hasCoreInSale = !!coreEntry;

  let totalCommission = 0;

  if (hasCoreInSale) {
    // --- CORE + ADDON BUNDLE ---
    // ADDONs with bundledCommission = null: fold into bundlePremium and earn the core rate.
    // ADDONs with bundledCommission set: excluded from bundlePremium; earn their own rate.
    const bundlePremium = allEntries
      .filter(e =>
        (e.product.type === "CORE" || e.product.type === "ADDON") &&
        e.product.bundledCommission === null
      )
      .reduce((sum, e) => sum + e.premium, 0);

    // Apply core product's rate to the combined bundle premium
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

    // --- ADDONs with their own bundledCommission rate (separate calculation) ---
    for (const entry of allEntries.filter(
      e => e.product.type === "ADDON" && e.product.bundledCommission !== null
    )) {
      const addonRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addonRate / 100);
    }

    // --- AD&D (separate calculation, bundled rate) ---
    for (const entry of allEntries.filter(e => e.product.type === "AD_D")) {
      if (entry.product.bundledCommission === null) {
        console.warn(`Product ${entry.product.id} has null bundledCommission rate`);
      }
      const addDRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addDRate / 100);
    }

    // --- BUNDLE QUALIFIER CHECK (collect reason, don't halve yet) ---
    if (bundleCtx && !bundleCtx.requiredAddonAvailable && !bundleCtx.fallbackAddonAvailable) {
      halvingReason = bundleCtx.halvingReason;
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

  // Apply enrollment fee rules
  const { finalCommission, enrollmentBonus, feeHalvingReason } = applyEnrollmentFee(
    totalCommission,
    sale.enrollmentFee !== null ? Number(sale.enrollmentFee) : null,
    sale.commissionApproved,
    hasCoreInSale,
    sale.product,
  );

  // Combine halving reasons — halve only once regardless of how many reasons
  // Reasons are ALWAYS collected; halving is ONLY applied when NOT approved
  const reasons = [halvingReason, feeHalvingReason].filter(Boolean);
  const combinedReason = reasons.length > 0 ? reasons.join("; ") : null;
  const halvedCommission = (combinedReason && !sale.commissionApproved) ? finalCommission / 2 : finalCommission;

  return {
    commission: Math.round((halvedCommission + enrollmentBonus) * 100) / 100,
    halvingReason: combinedReason,
  };
};

/**
 * Resolve bundle requirement context for a core product + member state combination.
 * Returns null if no bundle requirement is configured on the core product.
 */
export async function resolveBundleRequirement(
  coreProduct: {
    requiredBundleAddonId: string | null;
    requiredBundleAddon?: { name: string } | null;
    fallbackAddons?: { fallbackProduct: { id: string; name: string } }[];
  },
  memberState: string,
  saleAddonProductIds: string[],
  saleId?: string
): Promise<BundleRequirementContext> {
  if (!coreProduct.requiredBundleAddonId) return null;

  // D-03 (Phase 42): ACA PL auto-satisfies bundle requirement regardless of which
  // addon is configured as requiredBundleAddonId. This check must remain BEFORE the
  // state availability lookups so ACA covering sales bypass all fallback logic.
  if (saleId) {
    const acaCovering = await prisma.sale.findFirst({
      where: { acaCoveringSaleId: saleId, product: { type: "ACA_PL" }, status: "RAN" },
    });
    if (acaCovering) {
      return { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
    }
  }

  const requiredAvail = await prisma.productStateAvailability.findUnique({
    where: { productId_stateCode: { productId: coreProduct.requiredBundleAddonId, stateCode: memberState } }
  });
  const requiredAddonInSale = saleAddonProductIds.includes(coreProduct.requiredBundleAddonId);

  if (requiredAvail && requiredAddonInSale) {
    return { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
  }

  // If primary IS available but NOT in sale, half commission -- skip fallbacks entirely
  if (requiredAvail && !requiredAddonInSale) {
    const addonName = coreProduct.requiredBundleAddon?.name ?? "required addon";
    return {
      requiredAddonAvailable: false,
      fallbackAddonAvailable: false,
      halvingReason: `Half commission - missing ${addonName}`,
    };
  }

  // Only reach fallback loop when primary is NOT available in state (!requiredAvail)
  const fallbacks = coreProduct.fallbackAddons ?? [];
  for (const fb of fallbacks) {
    const fbAvail = await prisma.productStateAvailability.findUnique({
      where: { productId_stateCode: { productId: fb.fallbackProduct.id, stateCode: memberState } }
    });
    const fbInSale = saleAddonProductIds.includes(fb.fallbackProduct.id);
    if (fbAvail && fbInSale) {
      return { requiredAddonAvailable: false, fallbackAddonAvailable: true, halvingReason: null };
    }
  }

  const addonName = coreProduct.requiredBundleAddon?.name ?? "required addon";
  return {
    requiredAddonAvailable: false,
    fallbackAddonAvailable: false,
    halvingReason: `Half commission - missing ${addonName}`,
  };
}

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
    include: {
      product: {
        include: {
          requiredBundleAddon: { select: { name: true } },
          fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
        },
      },
      addons: { include: { product: true } },
    },
  });
  if (!sale) throw new Error("Sale not found");

  const addonProductIds = (sale.addons ?? []).map(a => a.productId);
  const bundleCtx = sale.memberState
    ? await resolveBundleRequirement(sale.product, sale.memberState, addonProductIds, saleId)
    : null;
  const result = calculateCommission(sale as Parameters<typeof calculateCommission>[0], bundleCtx);
  const payoutAmount = sale.status === 'RAN' ? result.commission : 0;
  const halvingReason = sale.status === 'RAN' ? result.halvingReason : null;

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
  const netAmount = payoutAmount + adjustment + bonus + fronted - hold;

  return prisma.payrollEntry.upsert({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
    create: {
      payrollPeriodId: period.id,
      saleId,
      agentId: sale.agentId,
      payoutAmount,
      netAmount: payoutAmount,
      halvingReason,
    },
    update: { payoutAmount, netAmount, halvingReason },
  });
};

/**
 * Find the oldest OPEN payroll period that has entries for a given agent.
 * Returns the period ID or null if no OPEN period exists for this agent.
 */
export async function findOldestOpenPeriodForAgent(agentId: string): Promise<string | null> {
  const period = await prisma.payrollPeriod.findFirst({
    where: {
      status: "OPEN",
      entries: { some: { agentId } },
    },
    orderBy: { weekStart: "asc" },
    select: { id: true },
  });
  return period?.id ?? null;
}

/**
 * Calculate commission for specific products in a sale (partial chargeback).
 * If productIds includes all products or is empty, returns the full payout amount.
 */
export function calculatePerProductCommission(
  sale: SaleWithProduct & { memberCount?: number | null; enrollmentFee?: unknown; commissionApproved?: boolean },
  productIds: string[],
  fullPayoutAmount: number,
): number {
  // Collect all product IDs in the sale
  const allProductIds = new Set<string>();
  allProductIds.add(sale.product.id);
  for (const addon of (sale.addons ?? [])) {
    allProductIds.add(addon.product.id);
  }

  // If all products selected or none specified, return full amount
  if (productIds.length === 0 || productIds.length >= allProductIds.size) {
    const allIncluded = productIds.every(id => allProductIds.has(id));
    if (allIncluded && productIds.length >= allProductIds.size) {
      return fullPayoutAmount;
    }
  }

  const selectedSet = new Set(productIds);
  const allEntries = [
    { product: sale.product, premium: Number(sale.premium) },
    ...(sale.addons ?? []).map(a => ({ product: a.product, premium: Number(a.premium ?? 0) })),
  ];

  const coreEntry = allEntries.find(e => e.product.type === "CORE");
  const hasCoreInSale = !!coreEntry;
  const coreSelected = coreEntry ? selectedSet.has(coreEntry.product.id) : false;

  let totalCommission = 0;

  // ACA_PL: flat commission
  if (sale.product.type === "ACA_PL" && selectedSet.has(sale.product.id)) {
    const flatAmount = Number(sale.product.flatCommission ?? 0);
    const count = sale.memberCount ?? 1;
    return Math.round(flatAmount * count * 100) / 100;
  }

  if (hasCoreInSale) {
    // Determine core rate
    const bundlePremium = allEntries
      .filter(e =>
        (e.product.type === "CORE" || e.product.type === "ADDON") &&
        e.product.bundledCommission === null
      )
      .reduce((sum, e) => sum + e.premium, 0);

    const threshold = Number(coreEntry!.product.premiumThreshold ?? 0);
    const rate = bundlePremium >= threshold
      ? Number(coreEntry!.product.commissionAbove ?? 0)
      : Number(coreEntry!.product.commissionBelow ?? 0);

    // Core product contribution
    if (coreSelected) {
      totalCommission += Number(sale.premium) * (rate / 100);
    }

    // Addons bundled into core (bundledCommission = null)
    for (const entry of allEntries.filter(
      e => e.product.type === "ADDON" && e.product.bundledCommission === null && selectedSet.has(e.product.id)
    )) {
      totalCommission += entry.premium * (rate / 100);
    }

    // Addons with own bundledCommission rate
    for (const entry of allEntries.filter(
      e => e.product.type === "ADDON" && e.product.bundledCommission !== null && selectedSet.has(e.product.id)
    )) {
      const addonRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addonRate / 100);
    }

    // AD_D (separate calculation, bundled rate)
    for (const entry of allEntries.filter(e => e.product.type === "AD_D" && selectedSet.has(e.product.id))) {
      const addDRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addDRate / 100);
    }

    // Enrollment fee bonus only if core is included
    if (coreSelected) {
      const enrollFee = sale.enrollmentFee != null ? Number(sale.enrollmentFee) : null;
      if (enrollFee !== null && enrollFee >= 125) {
        totalCommission += 10; // ENROLLMENT_BONUS_AMOUNT
      }
    }
  } else {
    // Standalone (no core)
    for (const entry of allEntries.filter(e => selectedSet.has(e.product.id))) {
      if (entry.product.type === "AD_D" || entry.product.type === "ADDON") {
        const rate = Number(entry.product.standaloneCommission ?? 0);
        totalCommission += entry.premium * (rate / 100);
      }
    }
  }

  return Math.round(totalCommission * 100) / 100;
}

export const isAgentPaidInPeriod = async (agentId: string, payrollPeriodId: string): Promise<boolean> => {
  const paidEntries = await prisma.payrollEntry.findMany({
    where: {
      payrollPeriodId,
      agentId,
      status: "PAID",
    },
  });
  return paidEntries.length > 0;
};

export const handleSaleEditApproval = async (saleId: string, changes: Record<string, { old: unknown; new: unknown }>, oldAgentId?: string) => {
  // If agent changed, delete old payroll entries under old agent
  if (oldAgentId && changes.agentId) {
    await prisma.payrollEntry.deleteMany({ where: { saleId, agentId: oldAgentId } });
  }

  // Check if the sale's current payroll entry is in a finalized period
  const existingEntries = await prisma.payrollEntry.findMany({
    where: { saleId },
    include: { payrollPeriod: true },
  });

  const finalizedEntry = existingEntries.find(e =>
    e.payrollPeriod.status === 'FINALIZED' || e.payrollPeriod.status === 'LOCKED'
  );

  if (finalizedEntry) {
    // Calculate old commission from the finalized entry
    const oldPayout = Number(finalizedEntry.payoutAmount);

    // Recalculate with new values to get new commission
    await upsertPayrollEntryForSale(saleId);

    // The upsert may have created a new entry in a different period (if date/payment changed)
    const newEntries = await prisma.payrollEntry.findMany({ where: { saleId } });
    const newEntry = newEntries.find(e => e.id !== finalizedEntry.id) || newEntries[0];

    if (newEntry && newEntry.id !== finalizedEntry.id) {
      // Different period -- new entry already correct, mark old as CLAWBACK_APPLIED
      await prisma.payrollEntry.update({
        where: { id: finalizedEntry.id },
        data: {
          adjustmentAmount: Number(finalizedEntry.adjustmentAmount) - oldPayout,
          status: 'CLAWBACK_APPLIED',
        },
      });
    } else {
      // Same period but finalized -- create adjustment in next open period
      await prisma.payrollEntry.update({
        where: { id: finalizedEntry.id },
        data: {
          adjustmentAmount: Number(finalizedEntry.adjustmentAmount) - oldPayout,
          status: 'CLAWBACK_APPLIED',
        },
      });
      // upsertPayrollEntryForSale already created new entry in correct period
    }
  } else {
    // No finalized period -- just recalculate normally
    await upsertPayrollEntryForSale(saleId);
  }
};
