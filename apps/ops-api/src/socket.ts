import { Server } from "socket.io";
import { invalidateAll, invalidate } from "./services/cache";

let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function emitAuditStarted(data: { callLogId: string; agentName: string }) {
  try {
    io?.emit("processing_started", data);
  } catch (err) {
    console.error("Socket.IO emit error (processing_started):", err);
  }
}

export function emitAuditStatus(data: { callLogId: string; status: string; attempt?: number }) {
  try {
    io?.emit("audit_status", data);
  } catch (err) {
    console.error("Socket.IO emit error (audit_status):", err);
  }
}

export function emitAuditComplete(audit: Record<string, unknown>) {
  try {
    io?.emit("new_audit", audit);
  } catch (err) {
    console.error("Socket.IO emit error (new_audit):", err);
  }
}

export function emitAuditFailed(data: { callLogId: string; error: string }) {
  try {
    io?.emit("processing_failed", data);
  } catch (err) {
    console.error("Socket.IO emit error (processing_failed):", err);
  }
}

export type SaleChangedType = "created" | "updated" | "status_changed" | "deleted";

export interface SaleChangedPayload {
  type: SaleChangedType;
  sale: {
    id: string;
    saleDate: string;
    memberName: string;
    memberId?: string;
    carrier: string;
    premium: number;
    enrollmentFee: number | null;
    status: string;
    agent: { id: string; name: string };
    product: { id: string; name: string; type: string };
    addons?: { product: { id: string; name: string; type: string } }[];
  };
  payrollEntries: {
    id: string;
    payoutAmount: number;
    adjustmentAmount: number;
    bonusAmount: number;
    frontedAmount: number;
    holdAmount: number;
    netAmount: number;
    status: string;
    periodId: string;
    periodWeekStart: string;
    periodWeekEnd: string;
  }[];
}

export function emitSaleChanged(payload: SaleChangedPayload) {
  try {
    io?.emit("sale:changed", payload);
  } catch (err) {
    console.error("Socket.IO emit error (sale:changed):", err);
  }
  invalidateAll();
}

export interface CSChangedPayload {
  type: "chargeback" | "pending_term";
  batchId: string;
  count: number;
}

export function emitCSChanged(payload: CSChangedPayload) {
  try {
    io?.emit("cs:changed", payload);
  } catch (err) {
    console.error("Socket.IO emit error (cs:changed):", err);
  }
  invalidateAll();
}

export interface AlertCreatedPayload {
  alertId: string;
  agentName?: string;
  amount?: number;
}

export function emitAlertCreated(payload: AlertCreatedPayload) {
  try {
    io?.emit("alert:created", payload);
  } catch (err) {
    console.error("Socket.IO emit error (alert:created):", err);
  }
}

export function emitAlertResolved(data: { alertId: string; status: "APPROVED" | "CLEARED" }) {
  try {
    io?.emit("alert:resolved", data);
  } catch (err) {
    console.error("Socket.IO emit error (alert:resolved):", err);
  }
  invalidateAll();
}

export interface ServicePayrollChangedPayload {
  type: "created" | "updated";
  periodId: string;
  serviceAgentId: string;
  totalPay: number;
}

export function emitServicePayrollChanged(payload: ServicePayrollChangedPayload) {
  try {
    io?.emit("service-payroll:changed", payload);
  } catch (err) {
    console.error("Socket.IO emit error (service-payroll:changed):", err);
  }
  invalidate("sales:/reporting");
}

export interface ClawbackCreatedPayload {
  clawbackId: string;
  saleId: string;
  agentName?: string;
  amount: number;
}

export function emitClawbackCreated(payload: ClawbackCreatedPayload) {
  try {
    io?.emit("clawback:created", payload);
  } catch (err) {
    console.error("Socket.IO emit error (clawback:created):", err);
  }
}
