# Phase 20: State-Aware Bundle Requirements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 20-state-aware-bundle-requirements
**Areas discussed:** Data model design, Commission halving UX, Config UI layout

---

## Data Model Design

### State Availability Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Join table (Recommended) | ProductStateAvailability table with productId + stateCode rows | ✓ |
| String[] on product | availableStates column as Postgres array | |

**User's choice:** Join table
**Notes:** Standard relational, easy to query "which products in FL?"

### Bundle Requirement Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Separate BundleRequirement table | Rows with coreProductId + state + requiredAddonId + fallbackAddonId + priority | |
| Fields on Product model | requiredBundleAddonId + fallbackBundleAddonId on Product | ✓ |

**User's choice:** Fields on Product model (initially selected separate table, then changed to "make it a core product config instead of separate table")
**Notes:** User wanted the config to live directly on the CORE product rather than a separate table. Simpler, one required addon + one fallback as FK fields on Product.

---

## Commission Halving UX

### Halving Reason Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline text under amount | Small text below commission amount like "Half commission — Compass VAB not bundled (FL)" | ✓ |
| Badge/pill on the row | Colored pill tag "HALVED" with hover for reason | |
| Separate reason column | New column in payroll entry table | |

**User's choice:** Inline text under amount
**Notes:** None

### Halving Reason Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Store on payroll entry (Recommended) | New halvingReason field — captures reason at time of calculation | ✓ |
| Compute on render | Derive from sale's memberState + current config | |

**User's choice:** Store on payroll entry
**Notes:** Survives config changes, captures reason at time of calculation

---

## Config UI Layout

### CORE Product Bundle Config

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible section in card | Expandable "Bundle Requirements" section within existing card edit view | ✓ |
| Separate config modal | Button opens modal with settings | |
| Below the card | Config renders directly below card when editing | |

**User's choice:** Collapsible section in card
**Notes:** None

### State Availability Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox grid | Grid of state abbreviations with checkboxes | |
| Multi-select dropdown | Searchable dropdown to pick states | ✓ |
| Toggle all + exceptions | "Available everywhere" toggle, pick exclusions | |

**User's choice:** Multi-select dropdown
**Notes:** Compact, familiar pattern

---

## Claude's Discretion

- US state list implementation approach
- Socket.IO event names for config changes
- Halving reason string format
- Completeness indicator visual design

## Deferred Ideas

None — discussion stayed within phase scope
