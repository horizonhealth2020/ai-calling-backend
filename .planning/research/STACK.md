# Technology Stack

**Project:** Ops Platform v2.1 -- Payroll Card Overhaul & Carryover System
**Researched:** 2026-04-01

## Key Finding: No New Dependencies Required

Every feature in this milestone is achievable with the existing stack. The carryover system is a backend data-flow concern (Prisma queries + payroll service logic). The pay card restructuring and print view enhancements are pure React component refactoring with inline styles. The ACA product editing reuses the existing Products tab CRUD pattern.

**Do NOT add any libraries for this milestone.** Adding a print library, PDF generator, or UI component library would violate the project's established patterns and create maintenance burden.

## Current Stack (No Changes)

### Core Framework
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 15.3.9 | Dashboard app framework | Keep as-is |
| Express | 4.19.2 | REST API server | Keep as-is |
| React | 18.3.1 | UI components | Keep as-is |
| TypeScript | 5.6.2 | Type safety | Keep as-is |
| Node.js | 20.x | Runtime | Keep as-is |

### Database
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| PostgreSQL | (Docker/Railway) | Primary datastore | Keep as-is |
| Prisma | 5.20.0 | ORM, migrations, client | Keep as-is -- new migration needed for carryover fields |

### Real-Time
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Socket.IO | 4.8.3 (server) / 4.8.3 (client) | Real-time dashboard cascade | Keep as-is |

### Validation & Utilities
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Zod | 3.23.8 | API input validation | Keep as-is -- new schemas for carryover endpoints |
| Luxon | 3.4.4 | Timezone-aware date handling | Keep as-is -- used for period week calculations |

### UI
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| lucide-react | 0.577.0 | Icon library | Keep as-is |
| @ops/ui | workspace | Design system (Badge, Button, Card, etc.) | Keep as-is |
| Inline CSSProperties | n/a | All styling | Keep as-is |

## Feature-to-Stack Mapping

### 1. Fronted/Hold Auto-Carryover Between Pay Periods

**Stack used:** Prisma + Express + Zod

**What's needed:**
- Prisma migration to add `bonusLabel` (String, nullable) and potentially `carryoverSourcePeriodId` (String, nullable) to PayrollEntry for tracking carryover origin
- New payroll service function: when a period transitions to LOCKED/FINALIZED, scan for agents with nonzero fronted/hold amounts and create corresponding entries in the next period
- New API endpoint or hook on period status change to trigger carryover
- Zod schema for carryover configuration

**Why no new library:** This is a database write triggered by a period status change. The existing `getSundayWeekRange` function already calculates next-period dates. Prisma transactions handle the atomic multi-row writes.

### 2. Editable Bonus Labels

**Stack used:** Prisma + React (inline styles)

**What's needed:**
- Prisma migration to add `bonusLabel` field to PayrollEntry (String, nullable, defaults to "Bonus")
- API patch endpoint already exists (`PATCH /payroll/entries/:id`) -- extend Zod schema to accept `bonusLabel`
- Client-side: inline text input or dropdown in the agent card header

**Why no new library:** A text input or select dropdown. The existing `SMALL_INP` style constant covers this pattern.

### 3. Pay Card Restructure (Agent-Level Collapsible Cards)

**Stack used:** React + inline CSSProperties

**What's needed:**
- Refactor `PeriodCard` component to group entries by agent first, then show individual sale rows nested inside
- Reuse existing `ChevronDown` icon and expand/collapse state pattern (already used for period expansion)
- Move bonus/fronted/hold inputs from individual sale rows to agent-level summary row

**Why no new library:** The codebase already implements collapsible cards with expand/collapse state for periods. The same pattern (boolean state + conditional render) applies to agent-level grouping. No accordion library needed.

### 4. Print View Enhancements

**Stack used:** Template literal HTML + `window.open` + `window.print()`

**What's needed:**
- Modify the existing print HTML template strings (lines ~1270-1370 in PayrollPeriods.tsx) to:
  - Remove net column from individual sale rows
  - Add "Approved" pill (green badge) on half-commission deals where `commissionApproved === true`
  - Clean up addon name formatting (strip prefixes, normalize casing)
- All changes are to the template string HTML, not React components

**Why no new library:** The print system uses raw HTML strings rendered in a new window. This is the simplest possible print approach and works well. Adding a PDF library (like jsPDF or react-to-print) would be over-engineering for what is already a working pattern. The changes are string template edits.

### 5. ACA Editable in Products Tab

**Stack used:** Existing PayrollProducts.tsx CRUD pattern

**What's needed:**
- Extend the `ProductCard` component to handle `ACA_PL` product type (currently handles CORE, ADDON, AD_D)
- Add `ACA_PL` to the `TYPE_LABELS` and `TYPE_COLORS` maps
- Ensure the product edit form shows `flatCommission` field for ACA_PL type
- API product routes already support all product types via Prisma

**Why no new library:** The Products tab already has full CRUD. ACA_PL products exist in the database. The UI just needs the type added to display maps and the flat commission field shown conditionally.

### 6. Zero-Value Validation Bug Fix

**Stack used:** Zod

**What's needed:**
- The current Zod schema uses `.min(0)` which rejects `0`. Change to `.min(0)` with explicit zero allowance, or the issue may be that `0` is being treated as falsy in JavaScript conditionals
- Inspect the PATCH `/payroll/entries/:id` handler -- the bug is likely in `parsed.data.bonusAmount ?? Number(entry.bonusAmount)` where `0` is not nullish but may be treated as "no change" somewhere in the UI

**Why no new library:** This is a validation logic fix, not a technology gap.

## Alternatives Considered

| Category | Considered | Why NOT |
|----------|-----------|---------|
| Print/PDF | react-to-print, jsPDF | Existing window.open+print pattern works. Adding a library for cosmetic print changes is over-engineering. |
| Accordion UI | @radix-ui/react-accordion | Project uses zero external UI libraries. Inline expand/collapse with useState is the established pattern. |
| State management | zustand, jotai | Not needed. Component-level useState + authFetch is the pattern. Carryover is server-side logic. |
| Form library | react-hook-form | Project uses manual form state with useState + Zod on the API. Consistent with 130K LOC of existing code. |
| Migration tool | Other than Prisma | Prisma is the established tool. No reason to change for schema additions. |

## Schema Changes Required (Prisma Migration)

```prisma
// Add to PayrollEntry model:
bonusLabel           String?  @map("bonus_label")        // "Bonus", "Hold Payout", custom
carryoverFromPeriodId String? @map("carryover_from_period_id")  // Track carryover origin

// Optional: Add carryover relation
carryoverFromPeriod  PayrollPeriod? @relation("CarryoverSource", fields: [carryoverFromPeriodId], references: [id])
```

**Alternative approach (simpler):** Instead of tracking carryover at the PayrollEntry level (which is per-sale), create a separate agent-level summary model or use the existing entry fields. Since bonus/fronted/hold are being moved to agent-level only, the carryover could be implemented as:

1. When period locks, for each agent with nonzero fronted/hold: find or create a PayrollEntry in the next period and add the carryover amounts
2. Track origin via audit log rather than a schema field (simpler, no migration for relation)

The roadmap phase should decide which approach based on how visible carryover provenance needs to be in the UI.

## Installation

No new packages to install. Existing `npm install` from monorepo root is sufficient.

```bash
# Only migration needed
npm run db:migrate
```

## What NOT to Add

| Library | Why Tempting | Why Wrong |
|---------|-------------|-----------|
| `react-to-print` | "Clean print integration" | Print already works via window.open. The changes are template string edits. |
| `@radix-ui/*` | "Accessible accordion for agent cards" | 130K LOC of inline CSSProperties + useState. Adding a component library now creates two patterns. |
| `zustand` | "Complex state for carryover tracking" | Carryover is server-side. Client just fetches and displays. |
| `react-query` / `swr` | "Better data fetching" | `authFetch` with `useEffect` is the universal pattern. Changing it means refactoring every component. |
| `decimal.js` | "Precise financial math" | Prisma Decimal fields + server-side calculation already handle precision. Client displays only. |

## Sources

- Prisma schema: `prisma/schema.prisma` (direct codebase inspection)
- Payroll service: `apps/ops-api/src/services/payroll.ts` (direct codebase inspection)
- Payroll routes: `apps/ops-api/src/routes/payroll.ts` (direct codebase inspection)
- Dashboard components: `apps/ops-dashboard/app/(dashboard)/payroll/` (direct codebase inspection)
- Package manifests: `package.json`, `apps/ops-api/package.json`, `apps/ops-dashboard/package.json` (direct codebase inspection)
- Project context: `.planning/PROJECT.md` (direct codebase inspection)
