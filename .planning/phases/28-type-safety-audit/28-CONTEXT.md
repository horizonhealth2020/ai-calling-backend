# Phase 28: Type Safety Audit - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate `any` types from application code, verify API response shapes match their typed definitions, and add explicit return type annotations to all shared package exports. No new features, no behavior changes — type safety hardening only.

</domain>

<decisions>
## Implementation Decisions

### `any` Elimination Scope
- **D-01:** Fix `any` in application code only — route handlers, services, dashboard components, and packages.
- **D-02:** Exclude test files (`__tests__/`, `*.test.ts`) and mock files from the audit.
- **D-03:** Allow `any` in Express error handler signature (`err: any` in global error handler) and `catch (err)` blocks where the error type is genuinely unknown. These are acceptable exceptions.
- **D-04:** Third-party type gaps (where no `@types/*` package exists) are excluded per success criteria.

### API Response Type Alignment
- **D-05:** Keep types where they are — API returns objects inline, dashboard defines local inline types. No new shared response type infrastructure in `@ops/types`.
- **D-06:** Audit route handlers and dashboard components to verify response shapes match. Fix mismatches where found (extra fields, missing fields, wrong types).
- **D-07:** This is a verification-and-fix pass, not a structural refactor. Minimize changes to working code.

### Package Export Annotations
- **D-08:** Every exported function in `@ops/auth`, `@ops/types`, `@ops/utils`, `@ops/ui`, and `@ops/db` gets an explicit return type annotation on its signature.
- **D-09:** No JSDoc additions — just type annotations. This is a stabilization milestone.
- **D-10:** Fix the 4 existing `any` occurrences in packages (`@ops/auth/client` has 2, `@ops/socket` has 2) with proper types.

### Claude's Discretion
- How to organize the audit (by app, by type of `any`, or by file)
- What specific types to use when replacing `any` (e.g., `unknown`, specific interfaces, union types)
- Grouping of changes into plans and commits
- Whether to use `unknown` or specific types for catch blocks that need narrowing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Type System
- `tsconfig.base.json` — Base TypeScript config with strict mode enabled
- `packages/types/src/index.ts` — Shared type definitions (`AppRole`, `SessionUser`)
- `packages/auth/src/index.ts` — Server-side auth exports needing return type annotations
- `packages/auth/src/client.ts` — Client-side auth exports (2 `any` occurrences to fix)

### Application Code (audit scope)
- `apps/ops-api/src/routes/*.ts` — 17 route files (~87 `any` occurrences)
- `apps/ops-api/src/services/*.ts` — Service files with `any` types
- `apps/ops-dashboard/app/(dashboard)/**/*.tsx` — Dashboard components (~92 `any` occurrences)

### Requirements
- `.planning/REQUIREMENTS.md` — TS-01, TS-02, TS-03 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Current `any` Distribution
- **ops-api:** ~87 occurrences across 22 files (heaviest: sales.ts at 23, convosoKpiPoller.ts at 10)
- **ops-dashboard:** ~92 occurrences across 15 files (heaviest: CSTracking.tsx at 42, PayrollPeriods.tsx at 11)
- **packages:** 4 occurrences across 2 files (auth/client.ts: 2, socket/useSocket.ts: 2)
- **sales-board:** 0 occurrences

### Established Patterns
- TypeScript strict mode enabled in `tsconfig.base.json`
- `type` keyword preferred over `interface` for data shapes
- Inline type aliases in page components for API response shapes (e.g., `type Agent = { id: string; ... }`)
- Union string types for enums (e.g., `type AppRole = "SUPER_ADMIN" | ...`)

### Integration Points
- `@ops/types` package is the central type repository — new shared types would go here if needed
- Dashboard components fetch from ops-api and cast responses to local inline types
- Route handlers return Prisma query results directly (types inferred from Prisma client)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-type-safety-audit*
*Context gathered: 2026-03-25*
