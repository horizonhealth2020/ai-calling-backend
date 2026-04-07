import { prisma } from "@ops/db";
import { emitAlertCreated, emitAlertResolved, emitClawbackCreated } from "../socket";
import { logAudit } from "./audit";
import { findOldestOpenPeriodForAgent, applyChargebackToEntry } from "./payroll";

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
  // 46-06: Socket emit is already try/catch'd inside emitAlertCreated, but wrap
  // here too so any future throw in the emit path cannot abort the alert row
  // insert that already committed above.
  try {
    emitAlertCreated({ alertId: alert.id, agentName, amount });
  } catch (err) {
    console.error("[alerts] emitAlertCreated failed (non-fatal):", err);
  }
  return alert;
}

export async function getPendingAlerts() {
  return prisma.payrollAlert.findMany({
    where: { status: "PENDING" },
    include: { chargeback: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveAlert(
  alertId: string,
  periodId: string | undefined,
  userId: string,
  manualSaleId?: string,
) {
  // Read-only fetch stays outside the transaction to minimize lock duration.
  const alert = await prisma.payrollAlert.findUnique({
    where: { id: alertId },
    include: {
      chargeback: {
        include: {
          matchedSale: {
            include: {
              // Phase 47 CR-01: deterministic ordering so applyChargebackToEntry
              // selects the correct "original" entry.
              payrollEntries: { orderBy: { createdAt: "asc" } },
              agent: true,
            },
          },
        },
      },
    },
  });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "PENDING") throw new Error("Alert already resolved");

  // If no periodId provided, auto-select oldest OPEN period for the agent.
  // findOldestOpenPeriodForAgent uses the module-level prisma client by design;
  // we resolve resolvedPeriodId BEFORE opening the transaction below so the
  // transaction body is purely the mutation path.
  let resolvedPeriodId = periodId;
  if (!resolvedPeriodId) {
    // For UNMATCHED alerts, the agent only becomes known after manualSaleId is
    // resolved inside the transaction; in that case, defer auto-select until
    // we have the picked sale's agent.
    const agentId = alert.chargeback?.matchedSale?.agentId || alert.agentId;
    if (agentId) {
      resolvedPeriodId = (await findOldestOpenPeriodForAgent(agentId)) ?? undefined;
    }
    // If we still don't have one and there is no manual pick to give us an agent,
    // bail early. If there IS a manual pick, the period will be auto-selected
    // inside the transaction once we know the picked sale's agent.
    if (!resolvedPeriodId && !manualSaleId) {
      throw new Error("No open payroll period found for this agent");
    }
  }

  // GAP-46-UAT-05 (46-10): Wrap the manual-pick mutation + dedupe + clawback
  // create + alert update in a single transaction so they all commit or all
  // roll back together. Without this, the chargebackSubmission could be
  // permanently mis-marked as MATCHED while the clawback creation fails,
  // leaving the alert in a state where a retry would silently dedupe.
  return await prisma.$transaction(async (tx) => {
    // GAP-46-UAT-05 (46-10): Allow manual sale-pick for UNMATCHED/MULTIPLE alerts.
    // When the chargeback has no matchedSaleId, the caller MUST supply manualSaleId
    // (the picked target sale). We then write it onto the chargeback row (also
    // flipping matchStatus → MATCHED) BEFORE running the existing clawback flow,
    // so the rest of this function operates on a populated alert.chargeback.matchedSale
    // unchanged.
    let saleId = alert.chargeback?.matchedSaleId;
    if (!saleId) {
      if (!manualSaleId) {
        throw new Error("Chargeback has no matched sale. Provide saleId in the approve request body to manually pick a target sale.");
      }
      // Verify the manual pick exists and pull the sale + agent for the rest of the flow.
      const pickedSale = await tx.sale.findUnique({
        where: { id: manualSaleId },
        include: { payrollEntries: { orderBy: { createdAt: "asc" } }, agent: true },
      });
      if (!pickedSale) throw new Error("Manually picked sale not found");

      // Persist the link on the chargeback row so future operations (UI refreshes,
      // dedupe checks, audit lookups) see it as a normal MATCHED chargeback.
      await tx.chargebackSubmission.update({
        where: { id: alert.chargebackSubmissionId },
        data: { matchedSaleId: manualSaleId, matchStatus: "MATCHED" },
      });

      // Re-read the alert with the now-populated matchedSale so the rest of the
      // function (period selection, dedupe, clawback create) works without branching.
      const refreshed = await tx.payrollAlert.findUnique({
        where: { id: alertId },
        include: {
          chargeback: {
            include: {
              matchedSale: {
                include: {
                  payrollEntries: { orderBy: { createdAt: "asc" } },
                  agent: true,
                },
              },
            },
          },
        },
      });
      if (!refreshed?.chargeback?.matchedSaleId) throw new Error("Failed to attach manual sale to chargeback");
      // Mutate local `alert` reference so the existing code below sees the picked sale.
      alert.chargeback = refreshed.chargeback;
      saleId = manualSaleId;

      // If we deferred period auto-select above (because we didn't know the agent
      // until we resolved the manual pick), do it now using the picked sale's agent.
      if (!resolvedPeriodId) {
        const pickedAgentId = pickedSale.agentId;
        if (pickedAgentId) {
          resolvedPeriodId = (await findOldestOpenPeriodForAgent(pickedAgentId)) ?? undefined;
        }
        if (!resolvedPeriodId) throw new Error("No open payroll period found for this agent");
      }
    }

    // Verify period is OPEN
    const period = await tx.payrollPeriod.findUnique({ where: { id: resolvedPeriodId! } });
    if (!period || period.status !== "OPEN") throw new Error("Selected period is not OPEN");

    // D-03: Dedupe guard -- prevent double clawbacks for same chargeback/sale combo.
    // 46-02: Also catch clawbacks created directly by the chargeback POST handler
    // (matchedBy "member_id" / "member_name"), which fire BEFORE any alert approval.
    // GAP-46-UAT-05 (46-10): Tighten the broad branch to constrain on matchedValue
    // (the chargeback's memberId / memberCompany) so it cannot false-positive
    // against unrelated prior batches against the same Sale. Verified at
    // chargebacks.ts that the auto-match path writes
    //   matchedBy: cb.memberId ? "member_id" : "member_name"
    //   matchedValue: cb.memberId || cb.memberCompany || ""
    // so this still catches the legacy auto-match-then-approve dedupe use case.
    // Phase 47 WR-06: constrain the member_id / member_name dedupe branches
    // to clawbacks created AFTER the alert's source chargeback row. Without
    // this bound, two legitimate chargebacks for the same member in different
    // batches would silently dedupe to the oldest clawback. The exact-match
    // chargeback_alert branch is still unconstrained because it's keyed on
    // chargebackSubmissionId (a unique FK) and cannot false-positive.
    const cbCreatedAt = alert.chargeback?.createdAt ?? new Date(0);
    const existingClawback = await tx.clawback.findFirst({
      where: {
        saleId,
        OR: [
          { matchedBy: "chargeback_alert", matchedValue: alert.chargebackSubmissionId },
          {
            matchedBy: "member_id",
            matchedValue: alert.chargeback?.memberId ?? "__none__",
            createdAt: { gte: cbCreatedAt },
          },
          {
            matchedBy: "member_name",
            matchedValue: alert.chargeback?.memberCompany ?? "__none__",
            createdAt: { gte: cbCreatedAt },
          },
        ],
      },
    });
    if (existingClawback) {
      const updatedExisting = await tx.payrollAlert.update({
        where: { id: alertId },
        data: {
          status: "APPROVED",
          approvedPeriodId: resolvedPeriodId,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
      emitAlertResolved({ alertId, status: "APPROVED" });
      await logAudit(userId, "alert_approved", "PayrollAlert", alertId, { periodId: resolvedPeriodId, clawbackId: existingClawback.id, dedupedFromBatch: true });
      return updatedExisting;
    }

    // D-04: Clawback amount = agent's commission portion from PayrollEntry, NOT chargeback amount.
    // Phase 47 CR-01/WR-01: pick the oldest non-clawback entry so we anchor to the
    // original live payout (not a prior clawback's cross-period negative row).
    const sale = alert.chargeback?.matchedSale;
    const liveEntries = (sale?.payrollEntries ?? []).filter((e: any) =>
      e.status !== "CLAWBACK_APPLIED" &&
      e.status !== "ZEROED_OUT_IN_PERIOD" &&
      e.status !== "CLAWBACK_CROSS_PERIOD"
    );
    const payrollEntry = liveEntries[0];
    const clawbackAmount = payrollEntry ? Number(payrollEntry.payoutAmount) : Number(alert.amount ?? 0);

    // Create clawback with correct sale reference
    const clawback = await tx.clawback.create({
      data: {
        saleId: saleId!,
        agentId: sale?.agentId || alert.agentId || "",
        matchedBy: "chargeback_alert",
        matchedValue: alert.chargebackSubmissionId,
        amount: clawbackAmount,
        status: "MATCHED",
        appliedPayrollPeriodId: resolvedPeriodId,
        notes: `Auto-created from chargeback. Commission clawback: $${clawbackAmount.toFixed(2)}`,
      },
    });

    // Phase 47-05: Apply payroll entry mutation via shared helper for parity
    // with the single-clawback (routes/payroll.ts) and batch (routes/chargebacks.ts)
    // paths. In-period zeros original entry; cross-period inserts new negative row.
    if (sale && sale.payrollEntries && sale.payrollEntries.length > 0) {
      await applyChargebackToEntry(
        tx,
        { id: saleId!, agentId: sale.agentId, payrollEntries: sale.payrollEntries },
        clawbackAmount,
      );
    }

    const updated = await tx.payrollAlert.update({
      where: { id: alertId },
      data: {
        status: "APPROVED",
        approvedPeriodId: resolvedPeriodId,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // CLAWBACK-05: Emit socket event for real-time payroll dashboard notification.
    // Inside the transaction callback so it only fires on commit.
    emitClawbackCreated({
      clawbackId: clawback.id,
      saleId: saleId!,
      agentName: sale?.agent?.name,
      amount: clawbackAmount,
    });

    emitAlertResolved({ alertId, status: "APPROVED" });
    await logAudit(userId, "alert_approved", "PayrollAlert", alertId, { periodId: resolvedPeriodId, clawbackId: clawback.id });
    return updated;
  }, { timeout: 15000 });
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
