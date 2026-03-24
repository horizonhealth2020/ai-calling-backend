import { Server } from "socket.io";

let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function emitAuditStarted(data: { callLogId: string; agentName: string }) {
  io?.emit("processing_started", data);
}

export function emitAuditStatus(data: { callLogId: string; status: string; attempt?: number }) {
  io?.emit("audit_status", data);
}

export function emitAuditComplete(audit: any) {
  io?.emit("new_audit", audit);
}

export function emitAuditFailed(data: { callLogId: string; error: string }) {
  io?.emit("processing_failed", data);
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
  io?.emit("sale:changed", payload);
}

export interface CSChangedPayload {
  type: "chargeback" | "pending_term";
  batchId: string;
  count: number;
}

export function emitCSChanged(payload: CSChangedPayload) {
  io?.emit("cs:changed", payload);
}

export interface AlertCreatedPayload {
  alertId: string;
  agentName?: string;
  amount?: number;
}

export function emitAlertCreated(payload: AlertCreatedPayload) {
  io?.emit("alert:created", payload);
}

export function emitAlertResolved(data: { alertId: string; status: "APPROVED" | "CLEARED" }) {
  io?.emit("alert:resolved", data);
}

export interface ServicePayrollChangedPayload {
  type: "created" | "updated";
  periodId: string;
  serviceAgentId: string;
  totalPay: number;
}

export function emitServicePayrollChanged(payload: ServicePayrollChangedPayload) {
  io?.emit("service-payroll:changed", payload);
}
