import { prisma } from "@ops/db";

export async function logAudit(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: object,
) {
  try {
    await prisma.appAuditLog.create({
      data: { actorUserId, action, entityType, entityId: entityId ?? null, metadata: metadata ?? undefined },
    });
  } catch {
    // Audit logging should never break the request
    console.error(`[audit] Failed to log: ${action} ${entityType} ${entityId ?? ""}`);
  }
}
