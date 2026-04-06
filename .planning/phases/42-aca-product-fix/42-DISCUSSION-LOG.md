# Phase 42: ACA Product Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 42-aca-product-fix
**Areas discussed:** Products tab visibility, Flat commission editing, Bundle requirement logic

---

## Products Tab Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| ACA PL products don't appear at all | The ACA PL group section is missing from Products tab entirely | ✓ |
| ACA PL products appear but can't be edited | Cards render but edit form doesn't work for ACA PL type | |
| Something else | A different visibility or rendering issue | |

**User's choice:** ACA PL products don't appear at all
**Notes:** Phase 39 implemented the ACA PL group display and passed UAT, but the products are not showing in production.

---

## Flat Commission Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Same bug — can't edit what you can't see | Fixing visibility will fix editing too | ✓ |
| Separate calculation issue | Flat commission not calculated correctly somewhere | |
| Both — visibility + calculation | Products tab invisible AND calculation wrong | |

**User's choice:** Same bug — can't edit what you can't see
**Notes:** No separate commission editing bug. The edit form from Phase 39 is expected to work once visibility is fixed.

---

## Bundle Requirement Logic

| Option | Description | Selected |
|--------|-------------|----------|
| ACA auto-satisfies any core bundle | Any ACA PL sold with core satisfies bundle regardless of config | ✓ |
| ACA must be set as required addon | ACA only satisfies if core's requiredBundleAddonId points to it | |
| ACA satisfies via acaCoveringSaleId | Existing self-relation pattern is correct, just verify | |

**User's choice:** ACA auto-satisfies any core bundle
**Notes:** User clarified with concrete example: Complete Care + ACA plan = addons earn full 70% bundled commission, not 35% standalone. Haven't been able to test this since ACA products aren't visible. Want to ensure the bundle path works end-to-end.

---

## Claude's Discretion

- Root cause investigation for visibility bug
- Test coverage for ACA bundle path
- Defensive checks for malformed ACA data

## Deferred Ideas

None
