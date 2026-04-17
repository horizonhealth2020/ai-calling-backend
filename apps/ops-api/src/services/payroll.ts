import { prisma } from "@ops/db";
import type { Product, Sale, SaleAddon, Prisma } from "@prisma/client";
import { DateTime } from 'luxon';

/** Prisma transaction client — use for composable helpers callable inside $transaction. */
export type PrismaTx = Prisma.TransactionClient;

const TIMEZONE = 'America/New_York';

/** Enrollment fee >= this threshold triggers the enrollment bonus */
export const ENROLLMENT_BONUS_THRESHOLD = 125;
/** Dollar amount of the enrollment bonus */
export const ENROLLMENT_BONUS_AMOUNT = 10;

/**
 * Pure helper: compute paycard net for a payroll entry.
 *
 * Formula: payout + adjustment + bonus - hold - fronted
 *
 * Fronted (mid-week cash advance) is deducted from net same-week — same semantics
 * as hold. The `frontedAmount` column is still persisted per entry.
 * `fronted` is optional (default 0) for backward compatibility with callers that
 * do not yet pass it.
 *
 * Chargebacks flow in as negative `adjustment` values (see `allowNegative` on
 * `adjustmentAmount` Zod schema).
 */
export const computeNetAmount = (args: {
  payout: number;
  adjustment: number;
  bonus: number;
  hold: number;
  fronted?: number;
}): number => {
  return args.payout + args.adjustment + args.bonus - args.hold - (args.fronted ?? 0);
};

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

  // Phase 46 GAP-46-02: detect "this AD&D/ADDON parent sale has at least one
  // linked ACA PL child sale". The self-relation is set on the CHILD ACA PL
  // sale's acaCoveringSaleId column, pointing UP at this parent. So we check
  // the inverse relation acaCoveredSales (loaded by upsertPayrollEntryForSale).
  const isAcaBundled = ((sale as SaleWithProduct & { acaCoveredSales?: { id: string }[] }).acaCoveredSales?.length ?? 0) > 0;

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
      const rawRate = (isAcaBundled && entry.product.acaBundledCommission != null)
        ? entry.product.acaBundledCommission
        : entry.product.bundledCommission;
      const addonRate = Number(rawRate ?? 0);
      totalCommission += entry.premium * (addonRate / 100);
    }

    // --- AD&D (separate calculation, bundled rate) ---
    for (const entry of allEntries.filter(e => e.product.type === "AD_D")) {
      const rawRate = (isAcaBundled && entry.product.acaBundledCommission != null)
        ? entry.product.acaBundledCommission
        : entry.product.bundledCommission;
      if (rawRate == null) {
        console.warn(`Product ${entry.product.id} has null bundledCommission rate`);
      }
      const addDRate = Number(rawRate ?? 0);
      totalCommission += entry.premium * (addDRate / 100);
    }

    // --- BUNDLE QUALIFIER CHECK (collect reason, don't halve yet) ---
    if (bundleCtx && !bundleCtx.requiredAddonAvailable && !bundleCtx.fallbackAddonAvailable) {
      halvingReason = bundleCtx.halvingReason;
    }
  } else {
    // --- STANDALONE (no core product) ---
    // Phase 46 GAP-46-01: when this sale is bundled with an ACA PL covering sale,
    // ADDON/AD_D entries prefer their acaBundledCommission rate over the
    // standalone rate, even though the sale itself has no core product.
    for (const entry of allEntries) {
      if (entry.product.type === "AD_D" || entry.product.type === "ADDON") {
        const useAcaRate = isAcaBundled && entry.product.acaBundledCommission != null;
        const rawRate = useAcaRate
          ? entry.product.acaBundledCommission
          : entry.product.standaloneCommission;
        if (!useAcaRate && entry.product.standaloneCommission === null) {
          console.warn(`Product ${entry.product.id} has null standaloneCommission rate`);
        }
        const rate = Number(rawRate ?? 0);
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
    halvingReason: (combinedReason && !sale.commissionApproved) ? combinedReason : null,
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
  saleId?: string,
  tx?: PrismaTx,
): Promise<BundleRequirementContext> {
  if (!coreProduct.requiredBundleAddonId) return null;

  const db = tx ?? prisma;

  // D-03 (Phase 42): ACA PL auto-satisfies bundle requirement regardless of which
  // addon is configured as requiredBundleAddonId. This check must remain BEFORE the
  // state availability lookups so ACA covering sales bypass all fallback logic.
  if (saleId) {
    const acaCovering = await db.sale.findFirst({
      where: { acaCoveringSaleId: saleId, product: { type: "ACA_PL" }, status: "RAN" },
    });
    if (acaCovering) {
      return { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
    }
  }

  const requiredAvail = await db.productStateAvailability.findUnique({
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
    const fbAvail = await db.productStateAvailability.findUnique({
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
export const handleCommissionZeroing = async (saleId: string, tx?: PrismaTx) => {
  // Phase 47 WR-02: accept optional tx so callers can atomically wrap the
  // Sale.update + commission-zeroing mutations. When no tx is supplied, fall
  // back to the module-level prisma client to preserve existing callers.
  const db = tx ?? prisma;
  const entries = await db.payrollEntry.findMany({
    where: { saleId },
    include: { payrollPeriod: true },
  });

  for (const entry of entries) {
    if (entry.payrollPeriod.status === 'OPEN') {
      await db.payrollEntry.update({
        where: { id: entry.id },
        data: { payoutAmount: 0, netAmount: 0, status: 'ZEROED_OUT' },
      });
    } else {
      // Finalized/locked/paid: apply clawback pattern (mirrors clawback logic in routes)
      await db.payrollEntry.update({
        where: { id: entry.id },
        data: {
          adjustmentAmount: Number(entry.adjustmentAmount) - Number(entry.netAmount),
          status: 'CLAWBACK_APPLIED',
        },
      });
    }
  }
};

export const upsertPayrollEntryForSale = async (saleId: string, tx?: PrismaTx) => {
  const db = tx ?? prisma;
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      product: {
        include: {
          requiredBundleAddon: { select: { name: true } },
          fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
        },
      },
      addons: { include: { product: true } },
      // Phase 46 GAP-46-02: detect "this AD&D/ADDON sale has linked ACA PL child(ren)"
      // so calculateCommission can apply acaBundledCommission rate. The acaCoveringSaleId
      // self-relation is set on the CHILD ACA PL sale, pointing UP at this parent.
      acaCoveredSales: {
        where: { product: { type: "ACA_PL" } },
        select: { id: true },
      },
    },
  });
  if (!sale) throw new Error("Sale not found");

  const addonProductIds = (sale.addons ?? []).map((a: { productId: string }) => a.productId);
  const bundleCtx = sale.memberState
    ? await resolveBundleRequirement(sale.product, sale.memberState, addonProductIds, saleId, tx)
    : null;
  const result = calculateCommission(sale as Parameters<typeof calculateCommission>[0], bundleCtx);
  const payoutAmount = sale.status === 'RAN' ? result.commission : 0;
  const halvingReason = sale.status === 'RAN' ? result.halvingReason : null;

  const shiftWeeks = sale.paymentType === 'ACH' ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(sale.saleDate, shiftWeeks);

  const period = await db.payrollPeriod.upsert({
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
  const existing = await db.payrollEntry.findUnique({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
  });
  const bonus = existing ? Number(existing.bonusAmount) : 0;
  const hold = existing ? Number(existing.holdAmount) : 0;
  const adjustment = existing ? Number(existing.adjustmentAmount) : 0;
  const fronted = existing ? Number(existing.frontedAmount) : 0;
  // Phase 78: fronted is a same-week deduction (reversed Phase 71 exclusion).
  // frontedAmount column is still persisted on the entry.
  const netAmount = computeNetAmount({ payout: payoutAmount, adjustment, bonus, hold, fronted });

  return db.payrollEntry.upsert({
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
 * Find the oldest OPEN payroll period (agent-agnostic).
 * Used by cross-period chargeback insertion where the target period may have
 * no existing entries for the agent yet.
 */
export async function findOldestOpenPeriod(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ id: string; weekStart: Date; weekEnd: Date } | null> {
  return tx.payrollPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { weekStart: "asc" },
    select: { id: true, weekStart: true, weekEnd: true },
  });
}

/**
 * Apply a chargeback to a sale's payroll entry.
 *
 * - If the sale's PayrollEntry lives in an OPEN period: zero in place with
 *   status=ZEROED_OUT_IN_PERIOD (yellow highlight in dashboard).
 * - If the sale's PayrollEntry lives in a LOCKED or FINALIZED period:
 *   insert a NEW negative PayrollEntry into the oldest OPEN period
 *   (agent-agnostic) with status=CLAWBACK_CROSS_PERIOD (orange highlight).
 *
 * Safe because PayrollEntry has @@unique([payrollPeriodId, saleId]) — the same
 * sale can have entries in multiple periods.
 */
export async function applyChargebackToEntry(
  tx: Prisma.TransactionClient,
  sale: {
    id: string;
    agentId: string;
    payrollEntries: { id: string; payrollPeriodId: string; payoutAmount: any; status?: string; createdAt?: Date }[];
  },
  chargebackAmount: number,
): Promise<{ mode: "in_period" | "cross_period"; entryId: string }> {
  // Phase 47 CR-01: Select the "original entry" deterministically. Exclude rows
  // that are themselves products of a prior clawback (CLAWBACK_APPLIED,
  // ZEROED_OUT_IN_PERIOD, CLAWBACK_CROSS_PERIOD) — those are NOT the live payout
  // we want to reverse. Prefer the oldest remaining entry (by createdAt asc).
  const nonClawbackEntries = sale.payrollEntries
    .filter(e =>
      e.status !== "CLAWBACK_APPLIED" &&
      e.status !== "ZEROED_OUT_IN_PERIOD" &&
      e.status !== "CLAWBACK_CROSS_PERIOD"
    )
    .slice()
    .sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ad - bd;
    });

  const originalEntry = nonClawbackEntries[0];
  if (!originalEntry) {
    throw new Error(
      `Sale ${sale.id} has no eligible live payroll entry to apply chargeback to (already fully clawed back)`,
    );
  }
  const originalPeriod = await tx.payrollPeriod.findUnique({
    where: { id: originalEntry.payrollPeriodId },
    select: { status: true },
  });

  // IN-PERIOD (OPEN) — zero original row in place, mark yellow
  if (originalPeriod?.status === "OPEN") {
    const updated = await tx.payrollEntry.update({
      where: { id: originalEntry.id },
      data: {
        payoutAmount: 0,
        netAmount: 0,
        status: "ZEROED_OUT_IN_PERIOD",
      },
    });
    return { mode: "in_period", entryId: updated.id };
  }

  // CROSS-PERIOD (LOCKED or FINALIZED) — insert new negative row in oldest OPEN period
  const oldestOpen = await tx.payrollPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { weekStart: "asc" },
    select: { id: true },
  });
  if (!oldestOpen) {
    throw new Error("No OPEN payroll period exists for cross-period chargeback");
  }

  // Safe because @@unique([payrollPeriodId, saleId]) allows same sale in different periods
  const created = await tx.payrollEntry.create({
    data: {
      payrollPeriodId: oldestOpen.id,
      saleId: sale.id,
      agentId: sale.agentId,
      payoutAmount: 0,
      adjustmentAmount: -chargebackAmount,
      netAmount: -chargebackAmount,
      status: "CLAWBACK_CROSS_PERIOD",
    },
  });
  return { mode: "cross_period", entryId: created.id };
}

/**
 * Phase 81: Reverse a Clawback — the inverse of `applyChargebackToEntry`.
 *
 * Used by `approveAlert` on RECOVERY-type PayrollAlerts. Caller MUST wrap in a
 * `prisma.$transaction` and handle socket emit + logAudit after commit.
 *
 * Modes:
 *   - in_period:      Delete the ZEROED_OUT_IN_PERIOD entry and call
 *                     `upsertPayrollEntryForSale(saleId, tx)` — re-derives
 *                     payoutAmount/netAmount/status via the SAME path that
 *                     originally created the entry (single source of truth).
 *   - cross_period:   Pre-delete state-verify (audit SR-6): entry must still
 *                     have payoutAmount === -clawback.amount AND status === CLAWBACK_CROSS_PERIOD.
 *                     If mismatch (payroll manually edited the row), throw
 *                     "Entry modified post-clawback; manual reconciliation required".
 *                     Otherwise delete the negative row.
 *
 * After entry handling, deletes ClawbackProduct children (FK), then Clawback.
 * If Prisma P2025 (RecordNotFound) fires on the Clawback delete, re-throw as
 * "Clawback not found" so caller's race-detection path can treat as idempotent.
 *
 * Throws (caller maps to HTTP errors):
 *   - "Clawback not found"
 *   - "Cannot reverse clawback: applied period is <status>. Payroll admin reversal required."
 *   - "Entry modified post-clawback (amount mismatch: expected X, got Y). Manual reconciliation required."
 *   - "Clawback <id>: cannot locate affected entry — manual reconciliation required"
 */
export async function reverseClawback(
  tx: Prisma.TransactionClient,
  clawbackId: string,
  options?: {
    // Test-only dependency injection for the upsert path. Production callers
    // omit this — reverseClawback uses the in-module upsertPayrollEntryForSale.
    upsertFn?: (saleId: string, tx?: PrismaTx) => Promise<{ id: string } | null>;
  },
): Promise<{
  mode: "in_period" | "cross_period";
  entryId: string;
  newEntryId?: string;
  periodId: string;
  saleId: string;
  agentId: string;
  amount: number;
}> {
  const upsert = options?.upsertFn ?? upsertPayrollEntryForSale;
  const clawback = await tx.clawback.findUnique({
    where: { id: clawbackId },
    include: {
      sale: {
        include: {
          payrollEntries: { orderBy: { createdAt: "asc" } },
          agent: true,
        },
      },
      appliedPayrollPeriod: true,
    },
  });
  if (!clawback) throw new Error("Clawback not found");

  if (clawback.appliedPayrollPeriod?.status !== "OPEN") {
    throw new Error(
      `Cannot reverse clawback: applied period is ${clawback.appliedPayrollPeriod?.status ?? "unknown"}. Payroll admin reversal required.`,
    );
  }

  if (!clawback.appliedPayrollPeriodId) {
    throw new Error(`Clawback ${clawbackId}: missing appliedPayrollPeriodId — manual reconciliation required`);
  }

  // Locate the entry this clawback mutated, scoped to the applied period.
  const entries = clawback.sale?.payrollEntries ?? [];
  const inPeriodEntry = entries.find(
    (e) => e.payrollPeriodId === clawback.appliedPayrollPeriodId && e.status === "ZEROED_OUT_IN_PERIOD",
  );
  const crossPeriodEntry = entries.find(
    (e) => e.payrollPeriodId === clawback.appliedPayrollPeriodId && e.status === "CLAWBACK_CROSS_PERIOD",
  );

  const clawbackAmt = Number(clawback.amount);
  const saleId = clawback.saleId;
  const agentId = clawback.agentId;
  const periodId = clawback.appliedPayrollPeriodId;

  let mode: "in_period" | "cross_period";
  let entryId: string;
  let newEntryId: string | undefined;

  if (inPeriodEntry) {
    mode = "in_period";
    entryId = inPeriodEntry.id;
    // Delete the ZEROED row, then re-upsert via single source of truth.
    await tx.payrollEntry.delete({ where: { id: inPeriodEntry.id } });
    const rebirth = await upsert(saleId, tx);
    newEntryId = rebirth?.id;
  } else if (crossPeriodEntry) {
    mode = "cross_period";
    entryId = crossPeriodEntry.id;
    // SR-6: pre-delete state verify — payroll may have manually edited the row.
    const actualPayout = Number(crossPeriodEntry.payoutAmount);
    const actualAdjustment = Number((crossPeriodEntry as { adjustmentAmount?: unknown }).adjustmentAmount ?? 0);
    // The clawback creates a row with payoutAmount=0 and adjustmentAmount=-clawbackAmt.
    // Verify both still match (tolerance 0.01 for Decimal/Number conversion).
    if (Math.abs(actualPayout - 0) > 0.01 || Math.abs(actualAdjustment - -clawbackAmt) > 0.01) {
      throw new Error(
        `Entry modified post-clawback (amount mismatch: expected payout=0 adjustment=-${clawbackAmt}, got payout=${actualPayout} adjustment=${actualAdjustment}). Manual reconciliation required.`,
      );
    }
    if (crossPeriodEntry.status !== "CLAWBACK_CROSS_PERIOD") {
      throw new Error(
        `Entry modified post-clawback (status is ${crossPeriodEntry.status}, expected CLAWBACK_CROSS_PERIOD). Manual reconciliation required.`,
      );
    }
    await tx.payrollEntry.delete({ where: { id: crossPeriodEntry.id } });
  } else {
    throw new Error(`Clawback ${clawbackId}: cannot locate affected entry — manual reconciliation required`);
  }

  // Delete FK children first, then the Clawback itself.
  await tx.clawbackProduct.deleteMany({ where: { clawbackId } });
  try {
    await tx.clawback.delete({ where: { id: clawbackId } });
  } catch (err: unknown) {
    // Prisma P2025 = record not found (race loser). Re-throw as "Clawback not found"
    // so caller's race-detection path handles idempotency.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2025") {
      throw new Error("Clawback not found");
    }
    throw err;
  }

  return { mode, entryId, newEntryId, periodId, saleId, agentId, amount: clawbackAmt };
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

  // Phase 47 WR-08: simplified guard. Previously the inner check could never
  // fire for the empty-list case because `0 >= allProductIds.size` is only true
  // for zero-product sales (impossible), contradicting the docstring.
  if (productIds.length === 0) return fullPayoutAmount;
  const allIncluded =
    allProductIds.size > 0 &&
    productIds.length >= allProductIds.size &&
    productIds.every(id => allProductIds.has(id));
  if (allIncluded) return fullPayoutAmount;

  const selectedSet = new Set(productIds);
  const allEntries = [
    { product: sale.product, premium: Number(sale.premium) },
    ...(sale.addons ?? []).map(a => ({ product: a.product, premium: Number(a.premium ?? 0) })),
  ];

  const coreEntry = allEntries.find(e => e.product.type === "CORE");
  const hasCoreInSale = !!coreEntry;
  const coreSelected = coreEntry ? selectedSet.has(coreEntry.product.id) : false;

  // Phase 46 GAP-46-02: ACA-bundled rate applies when the parent sale has at
  // least one linked ACA PL child (acaCoveredSales inverse relation). The
  // child is what carries acaCoveringSaleId; the parent has the inverse list.
  const isAcaBundled = ((sale as SaleWithProduct & { acaCoveredSales?: { id: string }[] }).acaCoveredSales?.length ?? 0) > 0;

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
      const rawRate = (isAcaBundled && entry.product.acaBundledCommission != null)
        ? entry.product.acaBundledCommission
        : entry.product.bundledCommission;
      const addonRate = Number(rawRate ?? 0);
      totalCommission += entry.premium * (addonRate / 100);
    }

    // AD_D (separate calculation, bundled rate)
    for (const entry of allEntries.filter(e => e.product.type === "AD_D" && selectedSet.has(e.product.id))) {
      const rawRate = (isAcaBundled && entry.product.acaBundledCommission != null)
        ? entry.product.acaBundledCommission
        : entry.product.bundledCommission;
      const addDRate = Number(rawRate ?? 0);
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
    // Phase 46 GAP-46-01: ACA-bundled rate preference for ADDON/AD_D entries
    for (const entry of allEntries.filter(e => selectedSet.has(e.product.id))) {
      if (entry.product.type === "AD_D" || entry.product.type === "ADDON") {
        const useAcaRate = isAcaBundled && entry.product.acaBundledCommission != null;
        const rawRate = useAcaRate
          ? entry.product.acaBundledCommission
          : entry.product.standaloneCommission;
        const rate = Number(rawRate ?? 0);
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

  const finalizedEntry = existingEntries.find((e: { payrollPeriod: { status: string }; id: string }) =>
    e.payrollPeriod.status === 'FINALIZED' || e.payrollPeriod.status === 'LOCKED'
  );

  if (finalizedEntry) {
    // Calculate old commission from the finalized entry
    const oldPayout = Number(finalizedEntry.payoutAmount);

    // Recalculate with new values to get new commission
    await upsertPayrollEntryForSale(saleId);

    // The upsert may have created a new entry in a different period (if date/payment changed)
    const newEntries = await prisma.payrollEntry.findMany({ where: { saleId } });
    const newEntry = newEntries.find((e: { id: string }) => e.id !== finalizedEntry.id) || newEntries[0];

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
