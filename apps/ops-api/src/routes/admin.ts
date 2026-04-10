import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { getAgentRetentionKpis } from "../services/agentKpiAggregator";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema } from "./helpers";

const router = Router();

// ─── Agent KPI Aggregation ──────────────────────────────────────

router.get("/agent-kpis", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const kpis = await getAgentRetentionKpis(dr);
  res.json(kpis);
}));

// ─── Permission Management ──────────────────────────────────────

const CONFIGURABLE_PERMISSIONS = [
  "create:sale", "create:chargeback", "create:pending_term",
  "create:rep", "create:agent", "create:product", "create:lead_source",
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: CONFIGURABLE_PERMISSIONS,
  OWNER_VIEW: ["create:sale", "create:chargeback", "create:pending_term", "create:rep", "create:agent", "create:product", "create:lead_source"],
  MANAGER: ["create:sale", "create:agent", "create:product", "create:lead_source"],
  PAYROLL: ["create:rep"],
  CUSTOMER_SERVICE: ["create:chargeback", "create:pending_term"],
  SERVICE: [],
  ADMIN: CONFIGURABLE_PERMISSIONS,
};

router.get("/permissions", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, roles: true },
    orderBy: { name: "asc" },
  });
  const overrides = await prisma.permissionOverride.findMany();

  // Build permission map: userId -> { permission -> granted }
  const permMap: Record<string, Record<string, boolean>> = {};
  for (const ov of overrides) {
    if (!permMap[ov.userId]) permMap[ov.userId] = {};
    permMap[ov.userId][ov.permission] = ov.granted;
  }

  const result = users.map((user) => {
    const roleDefaults = user.roles.flatMap((r) => ROLE_DEFAULTS[r] || []);
    const uniqueDefaults = [...new Set(roleDefaults)];
    const userOverrides = permMap[user.id] || {};

    const permissions: Record<string, { granted: boolean; isDefault: boolean; isOverride: boolean }> = {};
    for (const perm of CONFIGURABLE_PERMISSIONS) {
      const defaultGranted = uniqueDefaults.includes(perm);
      const hasOverride = perm in userOverrides;
      permissions[perm] = {
        granted: hasOverride ? userOverrides[perm] : defaultGranted,
        isDefault: !hasOverride,
        isOverride: hasOverride,
      };
    }

    return { id: user.id, name: user.name, roles: user.roles, permissions };
  });

  res.json({ users: result, configurablePermissions: CONFIGURABLE_PERMISSIONS });
}));

router.put("/permissions", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    overrides: z.array(z.object({
      userId: z.string(),
      permission: z.string(),
      granted: z.boolean(),
    })),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const userId = req.user!.id;
  const { overrides } = parsed.data;

  for (const ov of overrides) {
    await prisma.permissionOverride.upsert({
      where: { userId_permission: { userId: ov.userId, permission: ov.permission } },
      update: { granted: ov.granted, grantedBy: userId },
      create: { userId: ov.userId, permission: ov.permission, granted: ov.granted, grantedBy: userId },
    });
  }

  await logAudit(userId, "permissions_updated", "PermissionOverride", undefined, { count: overrides.length });
  res.json({ updated: overrides.length });
}));

// ─── Storage Stats ──────────────────────────────────────────────

router.get("/storage-stats", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const result = await prisma.$queryRaw<[{ db_size: bigint }]>`
    SELECT pg_database_size(current_database()) as db_size
  `;
  const dbSizeBytes = Number(result[0].db_size);
  const dbSizeMB = Math.round(dbSizeBytes / (1024 * 1024));

  // Get configurable threshold (default 80%)
  const thresholdSetting = await prisma.salesBoardSetting.findUnique({
    where: { key: "storage_alert_threshold_pct" },
  });
  const thresholdPct = thresholdSetting ? parseInt(thresholdSetting.value) : 80;

  // Get configurable plan limit in MB (default 1024 MB = 1 GB)
  const limitSetting = await prisma.salesBoardSetting.findUnique({
    where: { key: "storage_plan_limit_mb" },
  });
  const planLimitMB = limitSetting ? parseInt(limitSetting.value) : 1024;

  const usagePct = Math.round((dbSizeMB / planLimitMB) * 100);

  res.json({
    dbSizeMB,
    planLimitMB,
    usagePct,
    thresholdPct,
    alertActive: usagePct >= thresholdPct,
  });
}));

// ── Activity Feed (recent CS/manager actions for command center) ──
router.get("/activity-feed", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ limit: z.coerce.number().min(1).max(50).default(20), offset: z.coerce.number().min(0).default(0) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { limit, offset } = parsed.data;

  const [events, total] = await Promise.all([
    prisma.appAuditLog.findMany({
      where: {
        entityType: { in: ["Sale", "ChargebackSubmission", "PendingTerm"] },
        action: { in: ["CREATE", "UPDATE", "DELETE", "UPDATE_STATUS", "REQUEST_STATUS_CHANGE"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actorUserId: true },
    }),
    prisma.appAuditLog.count({
      where: {
        entityType: { in: ["Sale", "ChargebackSubmission", "PendingTerm"] },
        action: { in: ["CREATE", "UPDATE", "DELETE", "UPDATE_STATUS", "REQUEST_STATUS_CHANGE"] },
      },
    }),
  ]);

  // Resolve actor names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- actorUserId filter
  const userIds = [...new Set(events.map((e: any) => e.actorUserId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user map
  const userMap = new Map(users.map((u: any) => [u.id, u.name]));

  // Enrich with entity display data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event filtering
  const saleIds = events.filter((e: any) => e.entityType === "Sale" && e.entityId).map((e: any) => e.entityId!);
  const cbIds = events.filter((e: any) => e.entityType === "ChargebackSubmission" && e.entityId).map((e: any) => e.entityId!);
  const ptIds = events.filter((e: any) => e.entityType === "PendingTerm" && e.entityId).map((e: any) => e.entityId!);

  const [sales, chargebacks, pendingTerms] = await Promise.all([
    saleIds.length ? prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, memberName: true, premium: true, agent: { select: { name: true } }, product: { select: { name: true } } } }) : [],
    cbIds.length ? prisma.chargebackSubmission.findMany({ where: { id: { in: cbIds } }, select: { id: true, payeeName: true, totalAmount: true } }) : [],
    ptIds.length ? prisma.pendingTerm.findMany({ where: { id: { in: ptIds } }, select: { id: true, memberName: true, holdReason: true } }) : [],
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- entity maps
  const saleMap = new Map(sales.map((s: any) => [s.id, { agentName: s.agent?.name, memberName: s.memberName, premium: Number(s.premium), productName: s.product?.name }]));
  const cbMap = new Map(chargebacks.map((c: any) => [c.id, { payeeName: c.payeeName, totalAmount: Number(c.totalAmount) }]));
  const ptMap = new Map(pendingTerms.map((p: any) => [p.id, { memberName: p.memberName, holdReason: p.holdReason }]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event enrichment
  const enriched = events.map((e: any) => {
    let details: Record<string, unknown> | undefined;
    if (e.entityType === "Sale" && e.entityId) details = saleMap.get(e.entityId);
    else if (e.entityType === "ChargebackSubmission" && e.entityId) details = cbMap.get(e.entityId);
    else if (e.entityType === "PendingTerm" && e.entityId) details = ptMap.get(e.entityId);
    return {
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      details: details ?? {},
      createdAt: e.createdAt,
      actorName: e.actorUserId ? userMap.get(e.actorUserId) ?? "System" : "System",
    };
  });

  res.json({ events: enriched, total });
}));

export default router;
