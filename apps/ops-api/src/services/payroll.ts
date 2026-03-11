import { prisma } from "@ops/db";
import type { Product, Sale, SaleAddon } from "@prisma/client";

export const getSundayWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6));
  return { weekStart, weekEnd };
};

type SaleWithProduct = Sale & { product: Product; addons: (SaleAddon & { product: Product })[] };

/**
 * Calculate commission for a single product in context of a sale.
 *
 * Core:   commissionBelow / commissionAbove based on premium vs premiumThreshold
 * AD&D:   bundledCommission (70% default) if sold with core, standaloneCommission (35%) otherwise
 * Addon:  bundledCommission (match core) if sold with core, standaloneCommission (30%) otherwise
 */
function calcProductCommission(product: Product, premium: number, hasCoreInSale: boolean, coreProduct: Product | null): number {
  const prem = premium;

  if (product.type === "CORE") {
    const threshold = Number(product.premiumThreshold ?? 0);
    const rate = prem >= threshold
      ? Number(product.commissionAbove ?? 0)
      : Number(product.commissionBelow ?? 0);
    return prem * (rate / 100);
  }

  if (product.type === "AD_D") {
    const rate = hasCoreInSale
      ? Number(product.bundledCommission ?? 70)
      : Number(product.standaloneCommission ?? 35);
    return prem * (rate / 100);
  }

  // ADDON
  if (hasCoreInSale && coreProduct) {
    // If bundledCommission is set, use it; otherwise match core rate
    if (product.bundledCommission !== null && product.bundledCommission !== undefined) {
      return prem * (Number(product.bundledCommission) / 100);
    }
    // Match core product's applicable rate
    const threshold = Number(coreProduct.premiumThreshold ?? 0);
    const coreRate = prem >= threshold
      ? Number(coreProduct.commissionAbove ?? 0)
      : Number(coreProduct.commissionBelow ?? 0);
    return prem * (coreRate / 100);
  }

  // Standalone addon
  const rate = Number(product.standaloneCommission ?? 30);
  return prem * (rate / 100);
}

/**
 * Apply enrollment fee rules:
 *   $125 → +$10 bonus
 *   $99  → $0
 *   <$99 (or <$50 for standalone addon) → halve commission, unless approved
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

export const calculateCommission = (sale: SaleWithProduct): number => {
  const premium = Number(sale.premium);
  const product = sale.product;
  const addons = sale.addons ?? [];

  // Determine if there's a core product in this sale
  const allProducts = [product, ...addons.map(a => a.product)];
  const coreProduct = allProducts.find(p => p.type === "CORE") ?? null;
  const hasCoreInSale = coreProduct !== null;

  // Calculate commission for the primary product
  let totalCommission = calcProductCommission(product, premium, hasCoreInSale, coreProduct);

  // Calculate commission for each addon product
  for (const addon of addons) {
    totalCommission += calcProductCommission(addon.product, premium, hasCoreInSale, coreProduct);
  }

  // Apply enrollment fee rules
  const { finalCommission, enrollmentBonus } = applyEnrollmentFee(
    totalCommission,
    sale.enrollmentFee !== null ? Number(sale.enrollmentFee) : null,
    sale.commissionApproved,
    hasCoreInSale,
    product,
  );

  return finalCommission + enrollmentBonus;
};

export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: true, addons: { include: { product: true } } },
  });
  if (!sale) throw new Error("Sale not found");

  const payoutAmount = calculateCommission(sale);
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

  // Check if an existing entry has bonus/fronted to preserve those values
  const existing = await prisma.payrollEntry.findUnique({
    where: { payrollPeriodId_saleId: { payrollPeriodId: period.id, saleId } },
  });
  const bonus = existing ? Number(existing.bonusAmount) : 0;
  const fronted = existing ? Number(existing.frontedAmount) : 0;
  const adjustment = existing ? Number(existing.adjustmentAmount) : 0;
  const netAmount = payoutAmount + adjustment + bonus - fronted;

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
