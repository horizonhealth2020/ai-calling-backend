import { prisma } from "@ops/db";
import { emitAlertCreated, emitAlertResolved } from "../socket";
import { logAudit } from "./audit";

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

export async function approveAlert(alertId: string, periodId: string, userId: string) {
  const alert = await prisma.payrollAlert.findUnique({
    where: { id: alertId },
    include: { chargeback: true },
  });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "PENDING") throw new Error("Alert already resolved");

  // Verify period is OPEN
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status !== "OPEN") throw new Error("Selected period is not OPEN");

  // Create clawback in the selected period
  const clawback = await prisma.clawback.create({
    data: {
      saleId: alert.chargeback.memberId || "",
      agentId: alert.agentId || "",
      matchedBy: "chargeback_alert",
      matchedValue: alert.chargebackSubmissionId,
      amount: alert.amount || 0,
      status: "MATCHED",
      appliedPayrollPeriodId: periodId,
      notes: `Created from chargeback alert. Customer: ${alert.customerName || "unknown"}`,
    },
  });

  const updated = await prisma.payrollAlert.update({
    where: { id: alertId },
    data: {
      status: "APPROVED",
      approvedPeriodId: periodId,
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  emitAlertResolved({ alertId, status: "APPROVED" });
  await logAudit(userId, "alert_approved", "PayrollAlert", alertId, { periodId, clawbackId: clawback.id });
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
