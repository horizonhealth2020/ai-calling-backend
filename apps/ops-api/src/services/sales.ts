import type { PrismaTx } from "./payroll";

/**
 * Create an ACA covering child sale inside a transaction.
 *
 * The FK direction is intentional: `acaCoveringSaleId` lives on the CHILD sale,
 * pointing UP at its parent. The parent reads the link via the inverse relation
 * `acaCoveredSales`. Setting `acaCoveringSaleId` on the parent is WRONG.
 *
 * This helper mirrors the POST /sales/aca flow but is transaction-aware so
 * callers (e.g. the PATCH /sales/:id ACA-attach branch) can bundle child
 * creation + parent PayrollEntry recalculation + audit log in a single
 * atomic block.
 */
export async function createAcaChildSale(
  tx: PrismaTx,
  parentSaleId: string,
  input: { productId: string; memberCount: number; userId: string },
): Promise<{ id: string }> {
  // 1. Fetch parent sale for agentId, memberName, effectiveDate, leadSourceId, carrier
  const parent = await tx.sale.findUnique({
    where: { id: parentSaleId },
    select: {
      id: true,
      agentId: true,
      memberName: true,
      memberId: true,
      saleDate: true,
      effectiveDate: true,
      leadSourceId: true,
      carrier: true,
    },
  });
  if (!parent) throw new Error(`Parent sale ${parentSaleId} not found`);

  // 2. Verify the product is ACA_PL
  const product = await tx.product.findUnique({ where: { id: input.productId } });
  if (!product || product.type !== "ACA_PL") {
    throw new Error(`Product ${input.productId} is not ACA_PL`);
  }

  // 3. Create the child sale with acaCoveringSaleId pointing UP at the parent.
  //    premium is always 0 for ACA_PL child sales — the actual payout comes
  //    from product.flatCommission × memberCount, computed by
  //    calculateCommission in upsertPayrollEntryForSale.
  const child = await tx.sale.create({
    data: {
      saleDate: parent.saleDate,
      effectiveDate: parent.effectiveDate,
      agentId: parent.agentId,
      memberName: parent.memberName,
      memberId: parent.memberId,
      carrier: product.name,
      productId: input.productId,
      premium: 0,
      leadSourceId: parent.leadSourceId,
      status: "RAN",
      enteredByUserId: input.userId,
      memberCount: input.memberCount,
      acaCoveringSaleId: parent.id, // FK on CHILD → parent (inverse: parent.acaCoveredSales)
    },
    select: { id: true },
  });

  return child;
}

/**
 * Remove an ACA covering child sale and its PayrollEntry rows. Runs inside the
 * same transaction as the parent PATCH so the cascade is atomic.
 *
 * Payroll entries must be deleted before the Sale row because of the
 * PayrollEntry.saleId FK. Clawbacks and edit/status requests are not expected
 * on ACA child sales (they are internal-only), but we clear them defensively
 * to avoid FK failures if a child was ever edited directly.
 */
export async function removeAcaChildSale(
  tx: PrismaTx,
  _parentSaleId: string,
  childSaleId: string,
): Promise<void> {
  await tx.payrollEntry.deleteMany({ where: { saleId: childSaleId } });
  await tx.saleAddon.deleteMany({ where: { saleId: childSaleId } });
  await tx.clawback.deleteMany({ where: { saleId: childSaleId } });
  await tx.statusChangeRequest.deleteMany({ where: { saleId: childSaleId } });
  await tx.saleEditRequest.deleteMany({ where: { saleId: childSaleId } });
  await tx.sale.delete({ where: { id: childSaleId } });
}
