# Phase 26: Dead Code Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 26-dead-code-removal
**Areas discussed:** Audit scope boundaries

---

## Audit Scope Boundaries

### Morgan inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include Morgan (Recommended) | Audit imports, unused functions, and commented-out code in apps/morgan/ too | ✓ |
| Skip Morgan | Only audit the Ops Platform | |
| Morgan imports only | Only clean up unused imports in Morgan | |

**User's choice:** Include Morgan (Recommended)

### Export removal policy

| Option | Description | Selected |
|--------|-------------|----------|
| Remove unused exports | If nothing imports it, remove the export | |
| Keep public API exports | Keep exports in @ops/* packages even if unused | |
| You decide | Claude uses judgment | |

**User's choice:** "dont affect how system operates. im just cleaning house before launch"
**Notes:** User wants zero-risk cleanup. Remove only truly dead code. Leave anything that's part of a working flow.

---

## Claude's Discretion

- Audit organization approach (by app, by type, by file)
- Tooling choice (ESLint, depcheck, manual grep)
- Commit grouping strategy

## Deferred Ideas

None — discussion stayed within phase scope
