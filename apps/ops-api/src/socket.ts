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
