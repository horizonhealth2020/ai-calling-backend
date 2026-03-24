import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

router.get("/products", requireAuth, asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === "true";
  res.json(await prisma.product.findMany({
    where: includeInactive ? {} : { active: true },
    include: {
      requiredBundleAddon: { select: { id: true, name: true } },
      fallbackBundleAddon: { select: { id: true, name: true } },
      stateAvailability: { select: { stateCode: true } },
    },
  }));
}));

router.post("/products", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(["CORE", "ADDON", "AD_D"]).default("CORE"),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    notes: z.string().optional(),
    requiredBundleAddonId: z.string().nullable().optional(),
    fallbackBundleAddonId: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const product = await prisma.product.create({ data: parsed.data });
    await logAudit(req.user!.id, "CREATE", "Product", product.id, { name: product.name });
    res.status(201).json(product);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.patch("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    active: z.boolean().optional(),
    type: z.enum(["CORE", "ADDON", "AD_D"]).optional(),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    notes: z.string().nullable().optional(),
    requiredBundleAddonId: z.string().nullable().optional(),
    fallbackBundleAddonId: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        requiredBundleAddon: { select: { id: true, name: true } },
        fallbackBundleAddon: { select: { id: true, name: true } },
        stateAvailability: { select: { stateCode: true } },
      },
    });
    res.json(product);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.delete("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const hard = req.query.permanent === "true";
  if (hard) {
    // Check for sales referencing this product (these are not safe to cascade)
    const saleCount = await prisma.sale.count({ where: { productId: req.params.id } });
    const addonCount = await prisma.saleAddon.count({ where: { productId: req.params.id } });
    if (saleCount > 0 || addonCount > 0) {
      return res.status(409).json({ error: `Cannot delete — product has ${saleCount} sale(s) and ${addonCount} addon reference(s). Deactivate instead.` });
    }
    // Safe to cascade: clean up non-sale references then delete
    await prisma.productStateAvailability.deleteMany({ where: { productId: req.params.id } });
    await prisma.payoutRule.deleteMany({ where: { productId: req.params.id } });
    // Clear bundle FKs on other products pointing to this one
    await prisma.product.updateMany({ where: { requiredBundleAddonId: req.params.id }, data: { requiredBundleAddonId: null } });
    await prisma.product.updateMany({ where: { fallbackBundleAddonId: req.params.id }, data: { fallbackBundleAddonId: null } });
    await prisma.product.delete({ where: { id: req.params.id } });
    await logAudit(req.user!.id, "HARD_DELETE", "Product", req.params.id);
  } else {
    await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
    await logAudit(req.user!.id, "DEACTIVATE", "Product", req.params.id);
  }
  return res.status(204).end();
}));

router.patch("/products/:id/reactivate", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { active: true },
    include: {
      requiredBundleAddon: { select: { id: true, name: true } },
      fallbackBundleAddon: { select: { id: true, name: true } },
      stateAvailability: { select: { stateCode: true } },
    },
  });
  await logAudit(req.user!.id, "REACTIVATE", "Product", req.params.id);
  res.json(product);
}));

router.get("/products/:id/state-availability", requireAuth, asyncHandler(async (req, res) => {
  const entries = await prisma.productStateAvailability.findMany({
    where: { productId: req.params.id },
    select: { stateCode: true },
    orderBy: { stateCode: "asc" },
  });
  res.json(entries.map(e => e.stateCode));
}));

router.put("/products/:id/state-availability", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    stateCodes: z.array(z.string().length(2).regex(/^[A-Z]{2}$/)).max(51),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  await prisma.$transaction([
    prisma.productStateAvailability.deleteMany({ where: { productId: req.params.id } }),
    prisma.productStateAvailability.createMany({
      data: parsed.data.stateCodes.map(sc => ({ productId: req.params.id, stateCode: sc })),
    }),
  ]);

  const result = await prisma.productStateAvailability.findMany({
    where: { productId: req.params.id },
    select: { stateCode: true },
    orderBy: { stateCode: "asc" },
  });
  res.json(result.map(e => e.stateCode));
}));

export default router;
