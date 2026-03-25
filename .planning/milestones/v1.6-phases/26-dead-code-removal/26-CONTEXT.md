# Phase 26: Dead Code Removal - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and remove all unused code across the entire monorepo — imports, functions, components, exports, commented-out code, and unused dependencies. Zero behavior changes. If it's actively used, leave it alone.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope
- **D-01:** Include ALL code in the audit — Ops Platform (ops-api, ops-dashboard, sales-board, packages/*) AND Morgan voice service (apps/morgan/)
- **D-02:** Morgan is included for dead code cleanup (imports, unused functions, commented-out code, unused deps) — this is not a behavior change, just cleanup
- **D-03:** Do not affect how the system operates. This is purely removing dead weight before launch.

### Removal Policy
- **D-04:** Remove unused exports only if nothing in the codebase imports/calls them. If it's part of a working flow, leave it.
- **D-05:** Remove commented-out code blocks. Comments explaining "why" are fine; disabled code is not.
- **D-06:** Remove unused dependencies from package.json files — if no source file imports the package, remove it.
- **D-07:** Remove unused imports across all files.

### Safety
- **D-08:** Every removal must be verified to not break any existing functionality. Run tests after each batch of changes.
- **D-09:** Git history preserves everything — anything removed can be recovered if needed.

### Claude's Discretion
- How to organize the audit (by app, by type of dead code, or by file)
- Whether to use tooling (ESLint unused rules, depcheck) or manual grep-based auditing
- Grouping of changes into commits (by app, by type, or by file)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Monorepo Structure (post-Phase 25)
- `apps/ops-api/` — Express REST API with 17 route modules
- `apps/ops-dashboard/` — Unified Next.js dashboard with role-gated tabs
- `apps/sales-board/` — Standalone sales leaderboard
- `apps/morgan/` — AI voice calling service (JS, not TS)
- `packages/auth/` — @ops/auth JWT auth
- `packages/db/` — @ops/db Prisma client
- `packages/types/` — @ops/types shared types
- `packages/ui/` — @ops/ui shared UI components
- `packages/utils/` — @ops/utils logging and formatting
- `packages/socket/` — @ops/socket Socket.IO integration

### Package.json Files (for dependency audit)
- `package.json` — Root workspace config + Morgan deps
- `apps/ops-api/package.json` — API dependencies
- `apps/ops-dashboard/package.json` — Dashboard dependencies
- `apps/sales-board/package.json` — Sales board dependencies
- Each `packages/*/package.json` — Shared package dependencies

No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Codebase Scale
- ~128,000 LOC TypeScript/TSX across Ops Platform
- ~1,500 LOC JavaScript in Morgan voice service
- 17 route modules in ops-api after v1.5 split
- 6 shared packages under packages/

### Known Patterns
- Ops Platform uses TypeScript (strict mode not enforced)
- Morgan uses plain CommonJS JavaScript
- @ops/ui exports 14+ components — some may be unused after v1.3 consolidation
- Route helpers.ts exports asyncHandler and zodErr — likely all used
- packages/socket exports useSocket hook and event types

### Integration Points
- @ops/* packages are consumed by apps via workspace links
- Removing a package export could break any consuming app
- Morgan is independent — no cross-references to Ops Platform code

</code_context>

<specifics>
## Specific Ideas

- User emphasized: "don't affect how system operates. I'm just cleaning house before launch"
- Zero-risk approach — if in doubt, leave it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-dead-code-removal*
*Context gathered: 2026-03-25*
