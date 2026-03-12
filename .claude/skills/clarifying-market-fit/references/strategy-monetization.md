# Strategy and Monetization Reference

## Contents
- Platform value model
- Commission and incentive structures
- Product type hierarchy
- Enrollment fee thresholds
- Net amount formula
- Positioning the platform internally

---

## Platform Value Model

The Horizon Health Ops Platform does not charge users — it's an internal tool. Its value is **operational efficiency and financial accuracy** for a health insurance sales org. The monetization model it supports is agent commission payouts calculated from sales data.

The platform's internal value proposition by role:

| Role | Value delivered |
|------|----------------|
| MANAGER | Single place to log sales, track agents, audit calls |
| PAYROLL | Accurate, auditable commission calculations per week |
| OWNER_VIEW | Real-time KPI visibility without spreadsheet reconciliation |
| SUPER_ADMIN | Full platform control with audit trail |

---

## Commission and Incentive Structures

Commission data lives in `PayrollEntry`, linked to `Sale` and `Agent`. The net amount formula is defined in `apps/ops-api/src/services/payroll.ts`:

```
net = payout + adjustment + bonus - fronted
```

```typescript
// apps/ops-api/src/services/payroll.ts — net amount calculation
function calcNet(entry: PayrollEntry): Decimal {
  return entry.payout
    .plus(entry.adjustment)  // can be negative (chargeback)
    .plus(entry.bonus)
    .minus(entry.fronted);
}
```

**Critical:** `adjustment` allows negative values — chargebacks deduct from the current week when the original sale's period is already `PAID`. NEVER add `.min(0)` to `adjustmentAmount` in Zod validation.

---

## Product Type Hierarchy

Products have types that drive commission calculation and reporting groupings. The `Product` model in `prisma/schema.prisma` includes a `type` field used to distinguish:

```prisma
// prisma/schema.prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  type        String   // "CORE", "ADDON", "AD_D" etc.
  commissionPct Decimal
  // ...
}
```

When positioning the platform to payroll staff, frame products by type: core products carry base commission, add-ons stack on top.

---

## Enrollment Fee Thresholds

The platform supports enrollment fee logic that gates commission eligibility. Thresholds are configurable and affect whether a sale generates a payroll entry. When explaining the platform's value to PAYROLL users, this is a key accuracy feature — manual tracking in spreadsheets routinely fails on threshold edge cases.

```typescript
// Example threshold check in commission logic
// apps/ops-api/src/services/payroll.ts
if (sale.enrollmentFee < ENROLLMENT_THRESHOLD) {
  // Sale below threshold — no commission entry generated
  return null;
}
```

---

## Positioning the Platform Internally

When onboarding new managers or payroll staff, frame the platform's value in terms of what it replaces and what it prevents:

```
// Internal positioning language — use in onboarding docs or welcome copy

FOR MANAGERS:
"No more spreadsheets. Log sales here, track your agents here, and your commissions
are calculated automatically every week."

FOR PAYROLL:
"Payroll periods are locked once processed. Chargebacks from prior periods flow into
the current week automatically — no manual reconciliation."

FOR OWNERS:
"Real-time KPIs without waiting for the weekly payroll report. Agent performance,
sales volume, and premium totals updated live."
```

---

## WARNING: No Commission Rate Management UI

**Detected:** Commission percentages are stored per `Product` in the database but there is no self-service UI for SUPER_ADMIN or OWNER to update rates — changes require direct database edits or a custom API call.

**Impact:** Rate changes are risky (manual SQL), slow (requires developer access), and unaudited.

**Minimal Fix:** Add a rate management route gated to `SUPER_ADMIN`:

```typescript
// apps/ops-api/src/routes/index.ts
router.patch("/api/products/:id/commission",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = z.object({
      commissionPct: z.number().min(0).max(100),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { commissionPct: parsed.data.commissionPct },
    });

    logAudit(req, "commission_rate_updated", { productId: product.id, rate: product.commissionPct });
    res.json(product);
  })
);
```

See the **structuring-offer-ladders** skill for modeling product tier and incentive ladder design, and the **scoping-feature-work** skill for breaking this into a shippable feature increment.
