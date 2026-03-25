# Phase 28: Type Safety Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 28-type-safety-audit
**Areas discussed:** `any` elimination scope, API response type alignment, Package export annotations

---

## `any` Elimination Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Application code only | Fix `any` in routes, services, components, packages. Exclude tests/mocks. Allow Express error handler and catch block `any`. | ✓ |
| Everything except third-party gaps | Fix `any` everywhere including test files and mocks. Only exception is where third-party types don't exist. | |
| Strict zero tolerance | No `any` anywhere. Replace Express error handler `any` with `unknown`, cast catch errors explicitly. | |

**User's choice:** Application code only
**Notes:** Test files and mocks commonly use `any` for convenience without affecting production safety. Success criteria says "excluding node_modules and third-party type stubs."

---

## API Response Type Alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Shared types in `@ops/types` | Create response type definitions in shared package so API and dashboard reference same shapes. | |
| Inline per route, verified by audit | Keep types where they are. Audit to verify they match, fix mismatches. No new shared types. | ✓ |
| API-side only | Add explicit return types to route handlers only. Don't touch dashboard inline types. | |

**User's choice:** Inline per route, verified by audit
**Notes:** Creating shared response types is a larger refactor that could introduce import issues. Stabilization milestone — audit and fix is sufficient.

---

## Package Export Annotations

| Option | Description | Selected |
|--------|-------------|----------|
| Return types on all exported functions | Every exported function gets explicit return type. Makes public API self-documenting. | ✓ |
| Only where inference is wrong or unclear | Add return types only where TypeScript infers `any` or overly broad types. | |
| Full signatures with JSDoc | Explicit return types plus JSDoc comments on every export. | |

**User's choice:** Return types on all exported functions
**Notes:** Explicit return types on exports are best practice for library packages. Directly satisfies TS-03 wording. No JSDoc needed for stabilization.

---

## Claude's Discretion

- How to organize the audit (by app, by type of `any`, or by file)
- What specific types to use when replacing `any`
- Grouping of changes into plans and commits
- Whether to use `unknown` or specific types for catch blocks

## Deferred Ideas

None — discussion stayed within phase scope
