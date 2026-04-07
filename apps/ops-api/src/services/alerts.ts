import { prisma } from "@ops/db";
import { emitAlertCreated, emitAlertResolved, emitClawbackCreated } from "../socket";
import { logAudit } from "./audit";
import { findOldestOpenPeriodForAgent } from "./payroll";

export async function createAlertFromChargeback(
  chargebackId: string,
  agentName?: string,
  customerName?: string,
  amount?: number,
) {
  const alert = await prisma.payrollAlert.create({
    data: {
      chargebackSubmissionId: chargebackId,
      agentName: agentName || null,
      customerName: customerName || null,
      amount: amount != null ? amount : null,
    },
  });
  emitAlertCreated({ alertId: alert.id, agentName, amount });
  return alert;
}

export async function getPendingAlerts() {
  return prisma.payrollAlert.findMany({
    where: { status: "PENDING" },
    include: { chargeback: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveAlert(alertId: string, periodId: string | undefined, userId: string) {
  const alert = await prisma.payrollAlert.findUnique({
    where: { id: alertId },
    include: {
      chargeback: {
        include: {
          matchedSale: {
            include: {
              payrollEntries: true,
              agent: true,
            },
          },
        },
      },
    },
  });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "PENDING") throw new Error("Alert already resolved");

  // If no periodId provided, auto-select oldest OPEN period for the agent
  let resolvedPeriodId = periodId;
  if (!resolvedPeriodId) {
    const agentId = alert.chargeback?.matchedSale?.agentId || alert.agentId;
    if (agentId) {
      resolvedPeriodId = (await findOldestOpenPeriodForAgent(agentId)) ?? undefined;
    }
    if (!resolvedPeriodId) throw new Error("No open payroll period found for this agent");
  }

  // Verify period is OPEN
  const period = await prisma.payrollPeriod.findUnique({ where: { id: resolvedPeriodId } });
  if (!period || period.status !== "OPEN") throw new Error("Selected period is not OPEN");

  // CLAWBACK-01 fix: Use matchedSaleId, NOT memberId
  const saleId = alert.chargeback?.matchedSaleId;
  if (!saleId) throw new Error("Chargeback has no matched sale. Match manually before approving.");

  // D-03: Dedupe guard -- prevent double clawbacks for same chargeback/sale combo.
  // 46-02: Also catch clawbacks created directly by the chargeback POST handler
  // (matchedBy "member_id" / "member_name"), which fire BEFORE any alert approval.
  // In that case the clawback already exists and the alert just needs to leave the
  // pending queue -- do NOT throw, do NOT create a duplicate clawback.
  const existingClawback = await prisma.clawback.findFirst({
    where: {
      saleId,
      OR: [
        { matchedBy: "chargeback_alert", matchedValue: alert.chargebackSubmissionId },
        { matchedBy: { in: ["member_id", "member_name"] } },
      ],
    },
  });
  if (existingClawback) {
    const updatedExisting = await prisma.payrollAlert.update({
      where: { id: alertId },
      data: {
        status: "APPROVED",
        approvedPeriodId: resolvedPeriodId,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
    emitAlertResolved({ alertId, status: "APPROVED" });
    await logAudit(userId, "alert_approved", "PayrollAlert", alertId, { periodId: resolvedPeriodId, clawbackId: existingClawback.id, dedupedFromBatch: true });
    return updatedExisting;
  }

  // D-04: Clawback amount = agent's commission portion from PayrollEntry, NOT chargeback amount
  const sale = alert.chargeback.matchedSale;
  const payrollEntry = sale?.payrollEntries?.[0];
  const clawbackAmount = payrollEntry ? Number(payrollEntry.payoutAmount) : Number(alert.amount ?? 0);

  // Create clawback with correct sale reference
  const clawback = await prisma.clawback.create({
    data: {
      saleId,
      agentId: sale?.agentId || alert.agentId || "",
      matchedBy: "chargeback_alert",
      matchedValue: alert.chargebackSubmissionId,
      amount: clawbackAmount,
      status: "MATCHED",
      appliedPayrollPeriodId: resolvedPeriodId,
      notes: `Auto-created from chargeback. Commission clawback: $${clawbackAmount.toFixed(2)}`,
    },
  });

  const updated = await prisma.payrollAlert.update({
    where: { id: alertId },
    data: {
      status: "APPROVED",
      approvedPeriodId: resolvedPeriodId,
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  // CLAWBACK-05: Emit socket event for real-time payroll dashboard notification
  emitClawbackCreated({
    clawbackId: clawback.id,
    saleId,
    agentName: sale?.agent?.name,
    amount: clawbackAmount,
  });

  emitAlertResolved({ alertId, status: "APPROVED" });
  await logAudit(userId, "alert_approved", "PayrollAlert", alertId, { periodId: resolvedPeriodId, clawbackId: clawback.id });
  return updated;
}

export async function clearAlert(alertId: string, userId: string) {
  const alert = await prisma.payrollAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "PENDING") throw new Error("Alert already resolved");

  const updated = await prisma.payrollAlert.update({
    where: { id: alertId },
    data: {
      status: "CLEARED",
      clearedBy: userId,
      clearedAt: new Date(),
    },
  });

  emitAlertResolved({ alertId, status: "CLEARED" });
  await logAudit(userId, "alert_cleared", "PayrollAlert", alertId);
  return updated;
}
