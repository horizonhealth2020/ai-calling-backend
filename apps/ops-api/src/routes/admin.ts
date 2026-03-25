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

export default router;
