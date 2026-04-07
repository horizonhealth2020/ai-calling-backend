import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, isPrismaError, idParamSchema, booleanQueryParam } from "./helpers";

const router = Router();

router.get("/products", requireAuth, asyncHandler(async (req, res) => {
  const allQuery = z.object({ all: booleanQueryParam }).safeParse(req.query);
  const includeInactive = allQuery.success && allQuery.data.all;
  res.json(await prisma.product.findMany({
    where: includeInactive ? {} : { active: true },
    include: {
      requiredBundleAddon: { select: { id: true, name: true } },
      fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
      stateAvailability: { select: { stateCode: true } },
    },
  }));
}));

router.post("/products", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(["CORE", "ADDON", "AD_D", "ACA_PL"]).default("CORE"),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    flatCommission: z.number().min(0).nullable().optional(),
    notes: z.string().optional(),
    requiredBundleAddonId: z.string().nullable().optional(),
    fallbackAddonIds: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const { fallbackAddonIds, ...productData } = parsed.data;
    const product = await prisma.product.create({ data: productData });
    if (fallbackAddonIds && fallbackAddonIds.length > 0) {
      await prisma.coreProductFallback.createMany({
        data: fallbackAddonIds.map(fid => ({ coreProductId: product.id, fallbackProductId: fid })),
      });
    }
    await logAudit(req.user!.id, "CREATE", "Product", product.id, { name: product.name });
    res.status(201).json(product);
  } catch (e: unknown) {
    if (isPrismaError(e) && e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.patch("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({
    name: z.string().min(1).optional(),
    active: z.boolean().optional(),
    type: z.enum(["CORE", "ADDON", "AD_D", "ACA_PL"]).optional(),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    flatCommission: z.number().min(0).nullable().optional(),
    notes: z.string().nullable().optional(),
    requiredBundleAddonId: z.string().nullable().optional(),
    fallbackAddonIds: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const { fallbackAddonIds, ...updateData } = parsed.data;
    if (fallbackAddonIds !== undefined) {
      await prisma.coreProductFallback.deleteMany({ where: { coreProductId: pp.data.id } });
      if (fallbackAddonIds.length > 0) {
        await prisma.coreProductFallback.createMany({
          data: fallbackAddonIds.map(fid => ({ coreProductId: pp.data.id, fallbackProductId: fid })),
        });
      }
    }
    const product = await prisma.product.update({
      where: { id: pp.data.id },
      data: updateData,
      include: {
        requiredBundleAddon: { select: { id: true, name: true } },
        fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
        stateAvailability: { select: { stateCode: true } },
      },
    });
    res.json(product);
  } catch (e: unknown) {
    if (isPrismaError(e) && e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.delete("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const permQuery = z.object({ permanent: booleanQueryParam }).safeParse(req.query);
  const hard = permQuery.success && permQuery.data.permanent;
  if (hard) {
    // Check for sales referencing this product (these are not safe to cascade)
    const saleCount = await prisma.sale.count({ where: { productId: pp.data.id } });
    const addonCount = await prisma.saleAddon.count({ where: { productId: pp.data.id } });
    if (saleCount > 0 || addonCount > 0) {
      return res.status(409).json({ error: `Cannot delete — product has ${saleCount} sale(s) and ${addonCount} addon reference(s). Deactivate instead.` });
    }
    // Safe to cascade: clean up non-sale references then delete
    await prisma.productStateAvailability.deleteMany({ where: { productId: pp.data.id } });
    await prisma.payoutRule.deleteMany({ where: { productId: pp.data.id } });
    // Clear bundle FKs on other products pointing to this one
    await prisma.product.updateMany({ where: { requiredBundleAddonId: pp.data.id }, data: { requiredBundleAddonId: null } });
    await prisma.coreProductFallback.deleteMany({ where: { fallbackProductId: pp.data.id } });
    await prisma.product.delete({ where: { id: pp.data.id } });
    await logAudit(req.user!.id, "HARD_DELETE", "Product", pp.data.id);
  } else {
    await prisma.product.update({ where: { id: pp.data.id }, data: { active: false } });
    await logAudit(req.user!.id, "DEACTIVATE", "Product", pp.data.id);
  }
  return res.status(204).end();
}));

router.patch("/products/:id/reactivate", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const product = await prisma.product.update({
    where: { id: pp.data.id },
    data: { active: true },
    include: {
      requiredBundleAddon: { select: { id: true, name: true } },
      fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
      stateAvailability: { select: { stateCode: true } },
    },
  });
  await logAudit(req.user!.id, "REACTIVATE", "Product", pp.data.id);
  res.json(product);
}));

router.get("/products/:id/state-availability", requireAuth, asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const entries = await prisma.productStateAvailability.findMany({
    where: { productId: pp.data.id },
    select: { stateCode: true },
    orderBy: { stateCode: "asc" },
  });
  res.json(entries.map(e => e.stateCode));
}));

router.put("/products/:id/state-availability", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({
    stateCodes: z.array(z.string().length(2).regex(/^[A-Z]{2}$/)).max(51),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id: pp.data.id } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  await prisma.$transaction([
    prisma.productStateAvailability.deleteMany({ where: { productId: pp.data.id } }),
    prisma.productStateAvailability.createMany({
      data: parsed.data.stateCodes.map(sc => ({ productId: pp.data.id, stateCode: sc })),
    }),
  ]);

  const result = await prisma.productStateAvailability.findMany({
    where: { productId: pp.data.id },
    select: { stateCode: true },
    orderBy: { stateCode: "asc" },
  });
  res.json(result.map(e => e.stateCode));
}));

export default router;
