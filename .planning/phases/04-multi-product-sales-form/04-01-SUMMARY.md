---
phase: 04-multi-product-sales-form
plan: 01
subsystem: api, manager-dashboard
tags: [dropdown-defaults, product-filtering, addon-sorting, carrier-optional, zod]

requires:
  - phase: 02-commission-engine-core
    provides: Product type field (CORE, ADDON, AD_D) on Product model
provides:
  - CORE-only product dropdown filtering in sales form
  - ADDON-first then AD_D addon picker sorting
  - Optional carrier field on POST /sales API
  - Blank default dropdowns for product and lead source
affects: [manager-dashboard, ops-api]

tech-stack:
  added: []
  patterns: [product type filtering in dropdowns, localeCompare sorting for addon picker]

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/manager-dashboard/app/page.tsx

key-decisions:
  - "Carrier made optional with .optional().default('') to preserve existing DB behavior (empty string, not null)"
  - "Product dropdown filters to CORE type only; addon picker shows ADDON first then AD_D"

metrics:
  duration: 100s
  completed: "2026-03-15T15:01:30Z"
---

# Phase 4 Plan 1: Dropdown Defaults, Product Filtering & Carrier Optional Summary

**One-liner:** Fixed sales form dropdowns to start blank with placeholders, filtered products by type (CORE in main, ADDON/AD_D in picker), sorted addon picker, and made carrier optional across API and UI.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Make carrier optional in backend Zod schema | 123aa84 | `carrier: z.string().optional().default("")` in POST /sales schema |
| 2 | Fix dropdown defaults, product filtering, addon sorting, carrier optional on frontend | 02ba140 | Blank defaults, CORE filter, ADDON-first sort, carrier placeholder |

## Changes Made

### Backend (ops-api/src/routes/index.ts)
- POST /sales Zod schema: `carrier` changed from `z.string()` to `z.string().optional().default("")`
- PATCH schema already had carrier as optional -- no change needed

### Frontend (manager-dashboard/app/page.tsx)
- **Dropdown defaults:** Removed auto-selection of first product and lead source on load; both start as `""`
- **Product dropdown:** Added `<option value="" disabled>Select product...</option>` placeholder; filtered to `p.type === "CORE"` only; added `required`
- **Lead Source dropdown:** Added `<option value="" disabled>Select lead source...</option>` placeholder; added `required`
- **Carrier field:** Removed `required` attribute; added `placeholder="Optional"`
- **submitSale:** Added `carrier: form.carrier || undefined` to send undefined when empty (matches memberState pattern)
- **Addon picker:** Added `.sort()` that orders ADDON type first, then AD_D, alphabetical within each group via `localeCompare`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

All grep checks passed:
1. "Select product..." placeholder exists (line 939)
2. "Select lead source..." placeholder exists (line 946)
3. productId defaults to "" (lines 634, 675)
4. Addon sort with ADDON type check (line 1123)
5. Carrier optional in Zod schema (line 285)
6. Carrier placeholder "Optional" (line 926)
7. Carrier sent as undefined when empty (line 749)
