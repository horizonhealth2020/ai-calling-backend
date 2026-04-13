import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { emitCSChanged } from "../socket";
import { getSundayWeekRange, findOldestOpenPeriodForAgent, applyChargebackToEntry, calculatePerProductCommission, upsertPayrollEntryForSale, type PrismaTx } from "../services/payroll";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";
import { matchChargebacksToSales } from "../services/chargebacks";
import { batchRoundRobinAssign } from "../services/repSync";
import { createAlertFromChargeback } from "../services/alerts";

const router = Router();

const chargebackSchema = z.object({
  records: z.array(z.object({
    postedDate: z.string().nullable(),
    type: z.string().nullable(),
    payeeId: z.string().nullable(),
    payeeName: z.string().nullable(),
    payoutPercent: z.number().nullable(),
    chargebackAmount: z.number(),
    totalAmount: z.number().nullable(),
    transactionDescription: z.string().nullable(),
    product: z.string().nullable(),
    memberCompany: z.string().nullable(),
    memberId: z.string().nullable(),
    memberAgentCompany: z.string().nullable(),
    memberAgentId: z.string().nullable(),
    assignedTo: z.string().nullable(),
    selectedSaleId: z.string().nullable().optional(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
  // GAP-46-UAT-02 (46-07): discriminator that decides whether to fire the
  // CS → payroll alert pipeline. CS-originated submissions create alerts so
  // payroll can review them; payroll-originated submissions skip the alert
  // step because payroll IS the team that would otherwise approve. Server
  // defaults to "PAYROLL" — the safer regression for any unauthored caller.
  source: z.enum(["CS", "PAYROLL"]).optional().default("PAYROLL"),
});

const previewSchema = z.object({
  records: z.array(z.object({
    postedDate: z.string().nullable(),
    type: z.string().nullable(),
    payeeId: z.string().nullable(),
    payeeName: z.string().nullable(),
    payoutPercent: z.number().nullable(),
    chargebackAmount: z.number(),
    totalAmount: z.number().nullable(),
    transactionDescription: z.string().nullable(),
    product: z.string().nullable(),
    memberCompany: z.string().nullable(),
    memberId: z.string().nullable(),
    memberAgentCompany: z.string().nullable(),
    memberAgentId: z.string().nullable(),
  })),
});

router.post("/chargebacks/preview", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records } = parsed.data;
  const memberIds = records.map(r => r.memberId).filter(Boolean) as string[];
  const salesByMemberId = await matchChargebacksToSales(memberIds);

  const previews = records.map(record => {
    const matchingSales = record.memberId ? (salesByMemberId.get(record.memberId) || []) : [];
    let matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED";
    if (matchingSales.length === 1) matchStatus = "MATCHED";
    else if (matchingSales.length > 1) matchStatus = "MULTIPLE";
    else matchStatus = "UNMATCHED";

    return {
      ...record,
      matchStatus,
      matchedSales: matchingSales.map((sale: any) => {
        // Phase 47 WR-04: return per-product COMMISSION (not premium) so the
        // payroll review UI sums to the same number the server will write.
        // The server uses payoutAmount (sale commission) as the clawback basis;
        // premium is the wrong signal because premium != commission.
        const liveEntries = (sale.payrollEntries ?? []).filter((e: any) =>
          e.status !== "CLAWBACK_APPLIED" &&
          e.status !== "ZEROED_OUT_IN_PERIOD" &&
          e.status !== "CLAWBACK_CROSS_PERIOD"
        );
        const fullPayout = liveEntries[0] ? Number(liveEntries[0].payoutAmount) : 0;
        const productCommission = (productId: string) =>
          calculatePerProductCommission(
            sale as Parameters<typeof calculatePerProductCommission>[0],
            [productId],
            fullPayout,
          );

        return {
          id: sale.id,
          memberName: sale.memberName,
          agentName: sale.agent.name,
          agentId: sale.agentId,
          fullCommission: fullPayout,
          products: [
            {
              id: sale.product.id,
              name: sale.product.name,
              type: sale.product.type,
              premium: Number(sale.premium),
              commission: productCommission(sale.product.id),
            },
            ...sale.addons.map((a: any) => ({
              id: a.product.id,
              name: a.product.name,
              type: a.product.type,
              premium: Number(a.premium ?? 0),
              commission: productCommission(a.product.id),
            })),
          ],
        };
      }),
      selectedSaleId: matchingSales.length === 1 ? matchingSales[0].id : null,
    };
  });

  return res.json({ previews });
}));

router.post("/chargebacks", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = chargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records, rawPaste, batchId, source } = parsed.data;

  // Wrap createMany + matching + clawback creation + cursor advance in a single
  // transaction so a failed insert rolls back the round-robin cursor (Bug 3 fix).
  // Socket emits / audit logs that don't need atomicity stay outside the tx below.
  const { result, clawbackAuditPayloads, alertPayloads } = await prisma.$transaction(async (tx: PrismaTx) => {
    const created = await tx.chargebackSubmission.createMany({
      data: records.map((r) => ({
        postedDate: r.postedDate ? new Date(r.postedDate) : null,
        type: r.type,
        payeeId: r.payeeId,
        payeeName: r.payeeName,
        payoutPercent: r.payoutPercent,
        chargebackAmount: r.chargebackAmount,
        totalAmount: r.totalAmount,
        transactionDescription: r.transactionDescription,
        product: r.product,
        memberCompany: r.memberCompany,
        memberId: r.memberId,
        memberAgentCompany: r.memberAgentCompany,
        memberAgentId: r.memberAgentId,
        assignedTo: r.assignedTo,
        submittedBy: req.user!.id,
        batchId,
        rawPaste,
      })),
    });

    // Retrieve created chargebacks for matching and alert creation
    const createdChargebacks = await tx.chargebackSubmission.findMany({
      where: { batchId },
      orderBy: { createdAt: "desc" },
    });

    // Build selectedSaleId lookup from submitted records (D-03: user-resolved matches)
    const selectedSaleIdByMemberId = new Map<string, string>();
    for (const r of records) {
      if (r.selectedSaleId && r.memberId) {
        selectedSaleIdByMemberId.set(r.memberId, r.selectedSaleId);
      }
    }

    // Auto-match chargebacks to sales by memberId (D-01: exact match only)
    for (const cb of createdChargebacks) {
      // D-03: If frontend provided a selectedSaleId, verify and use it directly
      const userSelectedId = cb.memberId ? selectedSaleIdByMemberId.get(cb.memberId) : undefined;
      if (userSelectedId) {
        const selectedSale = await tx.sale.findUnique({
          where: { id: userSelectedId },
          select: { id: true, memberId: true },
        });
        if (selectedSale) {
          await tx.chargebackSubmission.update({
            where: { id: cb.id },
            data: { matchedSaleId: selectedSale.id, matchStatus: "MATCHED" },
          });
          continue;
        }
        // If selectedSaleId not found, fall through to automatic matching
      }

      if (cb.memberId) {
        const matchingSales = await tx.sale.findMany({
          where: { memberId: cb.memberId },
          select: { id: true },
        });

        if (matchingSales.length === 1) {
          await tx.chargebackSubmission.update({
            where: { id: cb.id },
            data: { matchedSaleId: matchingSales[0].id, matchStatus: "MATCHED" },
          });
        } else if (matchingSales.length > 1) {
          // D-02: Multiple matches -- flag for manual review, do NOT auto-select
          await tx.chargebackSubmission.update({
            where: { id: cb.id },
            data: { matchStatus: "MULTIPLE" },
          });
        } else {
          await tx.chargebackSubmission.update({
            where: { id: cb.id },
            data: { matchStatus: "UNMATCHED" },
          });
        }
      } else {
        await tx.chargebackSubmission.update({
          where: { id: cb.id },
          data: { matchStatus: "UNMATCHED" },
        });
      }
    }

    // Create clawbacks for matched chargebacks against agent's oldest open payroll period
    const refreshedChargebacks = await tx.chargebackSubmission.findMany({
      where: { batchId },
      orderBy: { createdAt: "desc" },
    });

    const auditPayloads: Array<{ clawbackId: string; saleId: string; status: string; amount: number; mode?: string; entryId?: string }> = [];
    const alertPayloadsLocal: Array<{ chargebackId: string; agentName?: string; memberName?: string; amount: number }> = [];

    for (const cb of refreshedChargebacks) {
      if (cb.matchStatus === "MATCHED" && cb.matchedSaleId) {
        // ── EXISTING MATCHED PATH (now uses shared applyChargebackToEntry helper) ──
        const sale = await tx.sale.findUnique({
          where: { id: cb.matchedSaleId },
          include: {
            payrollEntries: { orderBy: { createdAt: "asc" } },
            product: true,
            addons: { include: { product: true } },
            agent: true,
          },
        });
        if (!sale) continue;

        // Reference entry: prefer OPEN-period entry, fall back to oldest non-clawback entry.
        // Phase 47 CR-01/WR-01: exclude clawback-status rows so we don't anchor to a prior
        // clawback's cross-period negative row.
        const openPeriodId = await findOldestOpenPeriodForAgent(sale.agentId);
        const liveEntries = sale.payrollEntries.filter(e =>
          e.status !== "CLAWBACK_APPLIED" &&
          e.status !== "ZEROED_OUT_IN_PERIOD" &&
          e.status !== "CLAWBACK_CROSS_PERIOD"
        );
        const referenceEntry =
          (openPeriodId
            ? liveEntries.find(e => e.payrollPeriodId === openPeriodId)
            : undefined) ?? liveEntries[0];

        // Phase 47 WR-01: canonicalize on payoutAmount (the sale's own commission).
        // netAmount = payoutAmount + adjustment + bonus + fronted - hold, which pulls in
        // unrelated period-level adjustments. The alerts.ts path already uses payoutAmount;
        // align chargebacks.ts and payroll.ts with it.
        const chargebackAmount = referenceEntry ? Number(referenceEntry.payoutAmount) : Math.abs(Number(cb.chargebackAmount));

        const clawback = await tx.clawback.create({
          data: {
            saleId: sale.id,
            agentId: sale.agentId,
            matchedBy: cb.memberId ? "member_id" : "member_name",
            matchedValue: cb.memberId || cb.memberCompany || "",
            amount: chargebackAmount,
            status: "ZEROED",
            appliedPayrollPeriodId: openPeriodId || undefined,
            notes: `Batch chargeback (${batchId})`,
          },
        });

        // Shared helper: in-period zero vs cross-period negative insert
        const outcome = await applyChargebackToEntry(
          tx,
          { id: sale.id, agentId: sale.agentId, payrollEntries: sale.payrollEntries },
          chargebackAmount,
        );

        auditPayloads.push({ clawbackId: clawback.id, saleId: sale.id, status: clawback.status, amount: chargebackAmount, mode: outcome.mode, entryId: outcome.entryId });
        alertPayloadsLocal.push({
          chargebackId: cb.id,
          agentName: sale.agent?.name,
          memberName: sale.memberName ?? undefined,
          amount: chargebackAmount,
        });
      } else {
        // ── GAP-46-UAT-05 (46-10): UNMATCHED / MULTIPLE — queue an alert for manual review ──
        // No clawback is created here; payroll will pick a sale during approve and the
        // existing approveAlert flow will create the clawback at that point.
        alertPayloadsLocal.push({
          chargebackId: cb.id,
          agentName: cb.payeeName ?? cb.memberAgentCompany ?? undefined,
          memberName: cb.memberCompany ?? cb.memberId ?? undefined,
          amount: Math.abs(Number(cb.chargebackAmount)),
        });
      }
    }

    // Advance the round-robin cursor by exactly the number of rows inserted, inside
    // the same tx so a thrown error above rolls the cursor back to its pre-submit value.
    await batchRoundRobinAssign("chargeback", created.count, { persist: true, tx });

    return { result: created, clawbackAuditPayloads: auditPayloads, alertPayloads: alertPayloadsLocal };
  }, { timeout: 30000 });

  // Post-commit side effects: audit log writes (best-effort, non-atomic).
  for (const payload of clawbackAuditPayloads) {
    await logAudit(req.user!.id, "CREATE", "Clawback", payload.clawbackId, {
      saleId: payload.saleId,
      status: payload.status,
      amount: payload.amount,
      batchId,
    });
  }

  // GAP-46-UAT-01 diagnosis (46-06):
  // Root cause: Hypothesis A — alertPayloads is silently empty for CS-submitted
  //   chargebacks whose member has 0 or >1 sales in the DB. The matching loop
  //   at chargebacks.ts:157-186 only flips matchStatus="MATCHED" when exactly
  //   one sale exists for cb.memberId; the alertPayloads push at :242-247 is
  //   gated on "matchStatus === MATCHED" at :198. UAT round 1 Test 1 ("no
  //   alert in payroll") and Test 3 ("chargebacks exist, no alerts at all")
  //   are both explained by chargebacks landing in UNMATCHED/MULTIPLE with
  //   zero observable logging. createAlertFromChargeback + GET /api/alerts +
  //   payroll page.tsx:143 all work correctly end-to-end — the pipeline is
  //   starved at the source. Evidence:
  //     - chargebacks.ts:198 (gate)
  //     - chargebacks.ts:242-247 (push only when matched)
  //     - alerts.ts:24-30 getPendingAlerts (no hidden filter)
  //     - routes/alerts.ts:11-14 GET /alerts (no hidden filter)
  //     - payroll/page.tsx:143 + PayrollPeriods.tsx:849 (renders alerts.length>0)
  //     - CSSubmissions.tsx:595 sends {records, rawPaste, batchId} with no
  //       selectedSaleId, so every CS row auto-matches by memberId only.
  // Fix in Task 2: Make the silent empty-payloads path loud with a structured
  //   warn log (batchId, chargeback count, matched count, unmatched/multiple
  //   counts), track alertSuccessCount / alertErrors around createAlertFromChargeback
  //   with batchId + cbId context, and return alertCount in the 201 response
  //   so callers can detect the silent mode without scraping logs. Non-MATCHED
  //   chargebacks still flow through the existing /chargebacks UI — this plan
  //   does NOT change the alert-creation gate (that belongs to 46-07).
  // 46-06: Surface silent failure modes — log when payloads are empty AND track
  // per-cb success/failure with batchId+cbId context. Without this, the only
  // signal a CS user gets when their chargeback never reaches the payroll
  // dashboard is "the alert area is empty", which masks 3 distinct root causes
  // (no MATCHED rows, throw inside createAlertFromChargeback, downstream filter).
  // GAP-46-UAT-05 (46-10): The MATCHED gate above has been widened — UNMATCHED and
  // MULTIPLE chargebacks now also push alert payloads (without clawback creation) so
  // payroll can manually pick a sale during approve. See alerts.ts approveAlert for
  // the manual-pick branch that consumes this.
  // GAP-46-UAT-02 (46-07): alerts are a CS → payroll review queue.
  // Payroll-originated submissions skip the alert step because payroll IS
  // the team that would have approved the alert. The 46-06 observability
  // (empty-payloads warn, per-cb error log, batch summary log, alertCount
  // in 201 response) is preserved INSIDE the CS branch unchanged.
  let alertSuccessCount = 0;
  let alertErrors: string[] = [];
  if (source === "CS") {
    if (alertPayloads.length === 0) {
      console.warn(
        `[chargebacks] batch ${batchId}: 0 alert payloads built ` +
        `(${result.count} chargebacks submitted, none reached MATCHED status). ` +
        `No payrollAlert rows will be created. Check matchStatus on the inserted ` +
        `chargebackSubmission rows — UNMATCHED/MULTIPLE memberIds do not surface ` +
        `as alerts via the auto-match path.`,
      );
    }

    for (const p of alertPayloads) {
      try {
        await createAlertFromChargeback(p.chargebackId, p.agentName, p.memberName, p.amount);
        alertSuccessCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[chargebacks] batch ${batchId} cb=${p.chargebackId}: createAlertFromChargeback failed: ${msg}`,
        );
        alertErrors.push(`${p.chargebackId}: ${msg}`);
      }
    }
    if (alertErrors.length > 0) {
      console.error(
        `[chargebacks] batch ${batchId}: ${alertErrors.length}/${alertPayloads.length} ` +
        `alert creations failed (${alertSuccessCount} succeeded)`,
      );
    }
  } else {
    console.info(
      `[chargebacks] batch ${batchId}: source=${source}, skipping ${alertPayloads.length} ` +
      `alert creation(s) (direct-to-clawback path — payroll-originated submission)`,
    );
  }

  logAudit(req.user!.id, "CREATE", "ChargebackSubmission", batchId, {
    count: result.count,
    source,
  });

  return res.status(201).json({
    count: result.count,
    batchId,
    source,
    alertCount: alertSuccessCount,
    alertAttempted: alertPayloads.length,
    alertFailed: alertErrors.length,
  });
}));

router.delete("/chargebacks/:id", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const id = pp.data.id;

  const submission = await prisma.chargebackSubmission.findUnique({ where: { id } });
  if (!submission) return res.status(404).json({ error: "Chargeback not found" });

  // Collect saleIds that need payroll recalculation after cleanup
  const salesToRecalc: string[] = [];

  if (submission.matchedSaleId) {
    // Find clawbacks created by this chargeback (batch path or alert path)
    const clawbacks = await prisma.clawback.findMany({
      where: {
        saleId: submission.matchedSaleId,
        OR: [
          { matchedBy: "chargeback_alert", matchedValue: id },
          ...(submission.batchId ? [{ notes: { contains: submission.batchId } }] : []),
        ],
      },
    });

    if (clawbacks.length > 0) {
      const clawbackIds = clawbacks.map((c: { id: string }) => c.id);

      // Delete clawback products, then clawbacks
      await prisma.clawbackProduct.deleteMany({ where: { clawbackId: { in: clawbackIds } } });
      await prisma.clawback.deleteMany({ where: { id: { in: clawbackIds } } });
    }

    // Remove cross-period negative entries and zeroed-out entries for this sale
    await prisma.payrollEntry.deleteMany({
      where: {
        saleId: submission.matchedSaleId,
        status: { in: ["CLAWBACK_CROSS_PERIOD", "ZEROED_OUT_IN_PERIOD"] },
      },
    });

    salesToRecalc.push(submission.matchedSaleId);
  }

  // Delete related alerts and the submission
  await prisma.payrollAlert.deleteMany({ where: { chargebackSubmissionId: id } });
  await prisma.chargebackSubmission.delete({ where: { id } });

  // Recalculate payroll entries for affected sales (restores commission)
  for (const saleId of salesToRecalc) {
    await upsertPayrollEntryForSale(saleId);
  }

  await logAudit(req.user!.id, "DELETE", "ChargebackSubmission", id, {
    matchedSaleId: submission.matchedSaleId,
    salesToRecalc,
  });

  return res.status(204).end();
}));

// ─── Chargeback Resolution ──────────────────────────────────────

const resolveChargebackSchema = z.object({
  resolutionType: z.enum(["recovered", "closed", "no_contact"]),
  resolutionNote: z.string().min(1).max(2000),
  bypassReason: z.string().min(10).max(1000).optional(),
});

router.patch("/chargebacks/:id/resolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = resolveChargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  // Resolution gate: "closed" and "no_contact" require 3 CALL attempts
  if (parsed.data.resolutionType === "closed" || parsed.data.resolutionType === "no_contact") {
    const totalAttempts = await prisma.contactAttempt.count({
      where: { chargebackSubmissionId: pp.data.id },
    });
    // Pre-v2.9 records (0 total attempts) skip gate — never entered outreach workflow
    if (totalAttempts > 0) {
      const callAttempts = await prisma.contactAttempt.count({
        where: { chargebackSubmissionId: pp.data.id, type: "CALL" },
      });
      if (callAttempts < 3) {
        if (parsed.data.bypassReason) {
          logAudit(req.user!.id, "BYPASSED", "ChargebackSubmission", pp.data.id, {
            action: "RESOLUTION_GATE_BYPASSED",
            resolutionType: parsed.data.resolutionType,
            callAttempts,
            bypassReason: parsed.data.bypassReason,
          });
        } else {
          logAudit(req.user!.id, "BLOCKED", "ChargebackSubmission", pp.data.id, {
            action: "RESOLUTION_GATE_BLOCKED",
            resolutionType: parsed.data.resolutionType,
            callAttempts,
          });
          return res.status(400).json({ error: `3 call attempts required before closing. Current: ${callAttempts}/3` });
        }
      }
    }
  }

  const record = await prisma.chargebackSubmission.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: req.user!.id,
      resolutionNote: parsed.data.resolutionNote,
      resolutionType: parsed.data.resolutionType,
      bypassReason: parsed.data.bypassReason || null,
    },
  });
  logAudit(req.user!.id, "UPDATE", "ChargebackSubmission", pp.data.id, { resolutionType: parsed.data.resolutionType });
  emitCSChanged({ type: "chargeback", batchId: "resolution", count: 1 });
  return res.json(record);
}));

router.patch("/chargebacks/:id/unresolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const record = await prisma.chargebackSubmission.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionType: null,
    },
  });
  return res.json(record);
}));

router.get("/chargebacks", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const records = await prisma.chargebackSubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
    where: dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : undefined,
    include: {
      submitter: { select: { name: true } },
      resolver: { select: { name: true } },
      matchedSale: { select: { id: true, memberName: true, agentId: true } },
    },
  });
  return res.json(records);
}));

router.get("/chargebacks/weekly-total", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  let gte: Date, lt: Date, wsIso: string, weIso: string;
  if (dr) {
    gte = dr.gte;
    lt = dr.lt;
    wsIso = gte.toISOString();
    weIso = lt.toISOString();
  } else {
    const { weekStart, weekEnd } = getSundayWeekRange(new Date());
    const nextSunday = new Date(weekEnd);
    nextSunday.setDate(nextSunday.getDate() + 1);
    gte = weekStart;
    lt = nextSunday;
    wsIso = weekStart.toISOString();
    weIso = weekEnd.toISOString();
  }

  const result = await prisma.chargebackSubmission.aggregate({
    _sum: { chargebackAmount: true },
    _count: { id: true },
    where: { submittedAt: { gte, lt } },
  });

  return res.json({
    total: result._sum.chargebackAmount ?? 0,
    count: result._count.id,
    weekStart: wsIso,
    weekEnd: weIso,
  });
}));

router.get("/chargebacks/totals", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const dateFilter = dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : {};
  const [totalResult, recoveredResult] = await Promise.all([
    prisma.chargebackSubmission.aggregate({
      _sum: { chargebackAmount: true },
      _count: { id: true },
      where: dateFilter,
    }),
    prisma.chargebackSubmission.aggregate({
      _sum: { chargebackAmount: true },
      where: { ...dateFilter, resolutionType: "recovered" },
    }),
  ]);
  return res.json({
    totalChargebacks: totalResult._sum.chargebackAmount ? Math.abs(Number(totalResult._sum.chargebackAmount)) : 0,
    totalRecovered: recoveredResult._sum?.chargebackAmount ? Math.abs(Number(recoveredResult._sum.chargebackAmount)) : 0,
    recordCount: totalResult._count.id,
  });
}));

// ─── Stale Summary (spans chargebacks + pending terms) ─────────

router.get("/stale-summary", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const assignedToFilter = typeof req.query.assignedTo === "string" ? req.query.assignedTo.toLowerCase().trim() : null;
  const now = new Date();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  // Helper: midnight UTC of a date
  const midnightUTC = (d: Date) => {
    const m = new Date(d);
    m.setUTCHours(0, 0, 0, 0);
    return m;
  };

  // ── Chargebacks: batch fetch with latest attempt ──
  const allCbs = await prisma.chargebackSubmission.findMany({
    where: { resolvedAt: null },
    select: {
      id: true, memberCompany: true, memberId: true, assignedTo: true, createdAt: true,
      contactAttempts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  // ── Pending terms: unresolved ──
  const allPts = await prisma.pendingTerm.findMany({
    where: { resolvedAt: null },
    select: {
      id: true, memberName: true, memberId: true, assignedTo: true, createdAt: true, holdDate: true, product: true,
    },
  });

  // Apply assignedTo filter
  const matchesAgent = (val: string | null) => !assignedToFilter || (val || "").toLowerCase().trim() === assignedToFilter;
  const filteredCbs = allCbs.filter((cb: typeof allCbs[number]) => matchesAgent(cb.assignedTo));
  const filteredPts = allPts.filter((pt: typeof allPts[number]) => matchesAgent(pt.assignedTo));

  // Classify chargebacks
  const staleCbs: Array<typeof filteredCbs[number] & { staleSince: string; lastAttemptAt: string | null }> = [];
  const freshCbs: typeof filteredCbs = [];
  for (const cb of filteredCbs) {
    const lastAttempt = cb.contactAttempts[0]?.createdAt ?? null;
    const referenceTime = lastAttempt ? new Date(lastAttempt) : midnightUTC(new Date(cb.createdAt));
    const deadline = new Date(referenceTime.getTime() + FORTY_EIGHT_HOURS);
    if (now > deadline) {
      staleCbs.push({ ...cb, staleSince: deadline.toISOString(), lastAttemptAt: lastAttempt?.toISOString() ?? null });
    } else {
      freshCbs.push(cb);
    }
  }

  // Classify pending terms
  const stalePts: Array<typeof filteredPts[number] & { staleSince: string }> = [];
  const freshPts: typeof filteredPts = [];
  for (const pt of filteredPts) {
    const deadline = new Date(midnightUTC(new Date(pt.createdAt)).getTime() + FORTY_EIGHT_HOURS);
    if (now > deadline) {
      stalePts.push({ ...pt, staleSince: deadline.toISOString() });
    } else {
      freshPts.push(pt);
    }
  }

  // Build per-agent summary
  const agentMap = new Map<string, { staleChargebacks: number; stalePendingTerms: number }>();
  for (const cb of staleCbs) {
    const name = cb.assignedTo || "Unassigned";
    const entry = agentMap.get(name) || { staleChargebacks: 0, stalePendingTerms: 0 };
    entry.staleChargebacks++;
    agentMap.set(name, entry);
  }
  for (const pt of stalePts) {
    const name = pt.assignedTo || "Unassigned";
    const entry = agentMap.get(name) || { staleChargebacks: 0, stalePendingTerms: 0 };
    entry.stalePendingTerms++;
    agentMap.set(name, entry);
  }

  const agents = Array.from(agentMap.entries()).map(([name, counts]) => ({
    name,
    staleChargebacks: counts.staleChargebacks,
    stalePendingTerms: counts.stalePendingTerms,
    totalStale: counts.staleChargebacks + counts.stalePendingTerms,
  })).sort((a, b) => b.totalStale - a.totalStale);

  return res.json({
    agents,
    records: { chargebacks: staleCbs, pendingTerms: stalePts },
    allRecords: { chargebacks: [...staleCbs, ...freshCbs], pendingTerms: [...stalePts, ...freshPts] },
  });
}));

export default router;
