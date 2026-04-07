# Phase 46 - Discussion Log

> **Audit trail only.** Decisions captured in 46-CONTEXT.md.

**Date:** 2026-04-07
**Phase:** 46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with
**Mode:** discuss (interactive)

## Areas Discussed

- Bundle commission rate placement (Sub-feature 1)
- CS chargeback alert root-cause approach (Sub-feature 2)
- Minimized chargeback alert UI (Sub-feature 3)
- ACA print parity (Sub-feature 4)
- Single-action ACA cascade delete (Sub-feature 5 — added mid-session by user)

## Q&A

### Q1 — Bundle Commission box placement and content

**Options presented:**
1. Agent card summary tile (Recommended) — 6th tile next to Commission/Bonuses/Fronted/Hold/Net
2. Per-row inline chip — `Bundle: $X.XX` chip on each ACA-bundled row
3. Both — tile and per-row

**User answer (free text):** "It should be in the existing product box in the product tabs for add-ons and AD&D, same place standalone commission and core product bundle commission are."

**Interpretation:** User reframed the request — they want a new commission **rate field** on the Product model (alongside `standaloneCommission` and `bundledCommission`), edited in the Products tab, not a UI summary tile in the payroll card. Confirmed against `PayrollProducts.tsx` which has the existing Standalone/Bundled inputs at lines 305-313 (edit) and 605-615 (create).

**Resulting decisions:** D-01 through D-05.

### Q2 — CS chargeback alert root cause

**Options presented:**
1. Investigate first, then fix (Recommended)
2. Assume filter mismatch
3. Assume socket emission missing

**User answer:** "Investigate first, then fix"

**Resulting decisions:** D-06, D-07, D-08.

### Q3 — Minimized chargeback alert UI shape

**Options presented:**
1. Collapsed badge + click-to-expand inline panel (Recommended)
2. Toast with count + modal lookup
3. Sticky banner

**User answer:** "Collapsed badge + click-to-expand list"

**Resulting decisions:** D-09 through D-12.

### Q4 — ACA badge in print view

**Options presented:**
1. Add ACA as own column (Recommended)
2. Inline chip in Core column
3. Append to Add-on column

**User answer:** "Inline chip in Core column"

**User overrode the recommendation** — preferred to keep the existing column layout intact and render ACA as an inline chip alongside the core product, matching the on-screen payroll card pattern more closely.

**Resulting decisions:** D-13 through D-16.

### Q5 — Single-action delete (added mid-session)

**Trigger:** During CONTEXT.md drafting, user reported: "When deleting row from payroll for the ACA sale it deleted the complete card AD&D then I had to delete again for the ACA product. Make sure entire row deletes."

**Investigation:** Located `DELETE /sales/:id` at `apps/ops-api/src/routes/sales.ts:523-539`. Confirmed the transaction deletes only the parent's `saleAddon`, `clawback`, `payrollEntry`, `statusChangeRequest`, `saleEditRequest`, and `sale` rows — but does not touch any `Sale` rows linked via `acaCoveringSaleId` self-relation. This leaves the ACA child row orphaned in the database, which is why the payroll card still shows it on next refresh and requires a second delete click.

**Resulting decisions:** D-17 through D-20.

## Scope Creep Redirected

None — all five sub-features are within payroll/CS/ACA fix domain that originated from the user's phase request.

## Canonical Refs Discovered During Discussion

- `apps/ops-api/src/routes/sales.ts:523` — discovered while investigating Sub-feature 5
- `prisma/schema.prisma` Sale `acaCoveringSaleId` self-relation — referenced as the cascade target
