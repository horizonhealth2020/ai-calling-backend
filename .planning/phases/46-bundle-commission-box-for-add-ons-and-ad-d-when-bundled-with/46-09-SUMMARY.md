---
phase: 46
plan: 9
plan_id: 46-09
subsystem: ops-dashboard / payroll print view
tags: [print, aca, payroll, ui-parity, gap-closure, uat]
gap_closure: true
requirements: [GAP-46-UAT-04]
dependency_graph:
  requires:
    - 46-04 (folded ACA print chip + .prod-aca CSS classes)
    - 46-08 (chargeback container — sequenced first in same file)
  provides:
    - Standalone ACA_PL print parity in payroll Core column
  affects:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
tech-stack:
  added: []
  patterns:
    - "Bucket-key remap (ACA_PL → CORE) inside printAgentCards entries.map"
    - "Conditional inline HTML chip mirroring screen-side ACA_BADGE"
key-files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-09-SUMMARY.md
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - "Reused .prod-aca CSS class from 46-04 — no new style block needed"
  - "Branch on e.acaAttached to keep folded vs standalone cases mutually exclusive"
  - "Bucket remap done inline (ternary) rather than extending the byType map keys to avoid touching downstream printProd consumers"
metrics:
  duration: ~5m
  tasks_completed: 1 of 1
  files_modified: 1
  completed: 2026-04-07
---

# Phase 46 Plan 09: Standalone ACA_PL Print Chip Parity

GAP-46-UAT-04: Plan 46-04 added an inline ACA chip to the print view's Core column for the folded ACA case (`entry.acaAttached`), but did not handle entries whose primary product type is `ACA_PL` (standalone ACA sales — Bernice King-style). For those entries `byType.CORE` was empty (the optional-chained push silently no-op'd because the bucket map only declared `CORE/ADDON/AD_D`), so the print view rendered em-dashes across all four product columns despite a real product and payout.

## Tasks Completed

### Task 1: Render ACA_PL standalone product as a Core column chip
**Commit:** `60de89f`
**Files:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`

Three small edits inside `printAgentCards` `entries.map` (around lines 762-786):

**Before (line 762-764):**

```ts
const byType: Record<string, { name: string; premium?: number }[]> = { CORE: [], ADDON: [], AD_D: [] };
if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name, premium: ad.premium != null ? Number(ad.premium) : undefined });
```

**After:**

```ts
const byType: Record<string, { name: string; premium?: number }[]> = { CORE: [], ADDON: [], AD_D: [] };
if (e.sale?.product?.type) {
  // GAP-46-UAT-04: standalone ACA_PL sales render in the Core column
  // (mirrors WeekSection.tsx GAP-45-07 screen behavior — commit aeef119)
  const bucketKey = e.sale.product.type === "ACA_PL" ? "CORE" : e.sale.product.type;
  byType[bucketKey]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
}
if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name, premium: ad.premium != null ? Number(ad.premium) : undefined });
```

**New `acaStandaloneHtml` builder** (added directly after the existing `acaChipHtml` constant from 46-04):

```ts
// GAP-46-UAT-04: standalone ACA_PL marker chip — mirrors WeekSection.tsx:249 ACA_BADGE.
// Only renders when the primary product is ACA_PL AND not the folded acaAttached case
// (which is handled by acaChipHtml above).
const acaStandaloneHtml = (e.sale?.product?.type === "ACA_PL" && !e.acaAttached)
  ? `<span class="prod-aca">ACA</span>`
  : "";
```

**Core `<td>` injection** — appended `${acaStandaloneHtml}` after the existing `${acaChipHtml}`:

```ts
<td class="center core">${printProd(byType.CORE)}${acaChipHtml}${acaStandaloneHtml}</td>
```

The folded `acaChipHtml` line from 46-04 is byte-identical (only the new `acaStandaloneHtml` constant follows it). The two branches are mutually exclusive in practice: standalone ACA entries have `e.acaAttached === null`, folded entries have a Core/AD&D primary plus `e.acaAttached` set.

## acaChipHtml Preservation

The 46-04 line is preserved exactly:

```ts
const acaChipHtml = e.acaAttached
  ? `<span class="prod-aca">${e.acaAttached.productName ?? "ACA"}</span><span class="prod-aca-amt">$${Number(e.acaAttached.payoutAmount).toFixed(2)}</span>`
  : "";
```

No edits to characters, whitespace, or order. Only a new constant follows it.

## Plan Compliance

- Bucket remap done in a single ternary — no helper extraction
- No new CSS classes — `.prod-aca` already exists at line 729 from 46-04
- No changes outside `printAgentCards` (lines 696-803)
- No touch to chargeback container (46-08's region, lines 848-1000)
- Folded ACA case (`e.acaAttached`) preserved byte-identical

## Verification

- `grep -c acaStandaloneHtml PayrollPeriods.tsx` → 2 (declaration + injection)
- `grep -c GAP-46-UAT-04 PayrollPeriods.tsx` → 2 (both comment markers present)
- `grep -n ACA_PL PayrollPeriods.tsx` → 3 lines inside `printAgentCards` (764, 766, 778, 779, 781) — all new from this plan
- `acaChipHtml = e.acaAttached` line preserved (grep confirms unchanged)
- No `.prod-aca-standalone` class introduced — reusing existing `.prod-aca`

## Sequencing Note (Wave 2)

This plan ran **second** in wave 2 after 46-08 landed the always-render chargeback container. Both plans modify `PayrollPeriods.tsx` but in disjoint regions:

- 46-08: chargeback container render block (lines 848-1000)
- 46-09: `printAgentCards` print view (lines 696-803)

Sequenced atomically on the main working tree — 46-08 commit `6216312` first, then 46-09 commit `60de89f`. No merge conflicts, no overlapping lines.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx (modified, contains acaStandaloneHtml + GAP-46-UAT-04 + ACA_PL inside printAgentCards)
- FOUND: commit 60de89f on main
- FOUND: .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-09-SUMMARY.md (this file)
