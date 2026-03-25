# Phase 25: File Structure Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 25-file-structure-cleanup
**Areas discussed:** Morgan relocation strategy, Root file cleanup scope, Doc consolidation approach

---

## Morgan Relocation Strategy

### Morgan package.json

| Option | Description | Selected |
|--------|-------------|----------|
| Own package.json (Recommended) | Morgan gets apps/morgan/package.json with only its deps. Root package.json becomes pure workspace config. | |
| Keep deps in root | Just move the files, leave dependencies in root package.json. Simpler but messier. | |

**User's choice:** "WHATEVER IS BEST AS LONG AS IT DOESNT AFFECT HOW MORGAN REPO IS CURRENTLY OPERATING. ITS WORKING SUCCESSFULLY"
**Notes:** User prioritized zero-risk over clean separation. Decision: keep deps in root package.json since Railway runs npm install from root.

### Morgan tests location

| Option | Description | Selected |
|--------|-------------|----------|
| apps/morgan/__tests__/ (Recommended) | Tests move with the code, jest.config.js moves too. Self-contained app. | ✓ |
| Keep at root __tests__/ | Update require paths to point into apps/morgan/. Tests stay separate from code. | |

**User's choice:** apps/morgan/__tests__/ (Recommended)

### Deployment config location

| Option | Description | Selected |
|--------|-------------|----------|
| Move to apps/morgan/ | Each app owns its deployment config. | |
| Keep at root, update paths | Railway reads from repo root by default. | ✓ |
| You decide | Claude picks the approach. | |

**User's choice:** Keep at root, update paths

---

## Root File Cleanup Scope

### Empty payroll-dashboard directory

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Empty directory, no files, no references. | ✓ |
| Keep it | Leave as placeholder. | |

**User's choice:** Delete it

---

## Doc Consolidation Approach

### Stale doc handling

| Option | Description | Selected |
|--------|-------------|----------|
| Keep useful bits in README (Recommended) | Merge Railway service table and Morgan known issues into README sections, delete originals. | ✓ |
| Move to apps/morgan/ | Morgan-specific docs go into apps/morgan/docs/. Railway info into README. | |
| Delete everything | CLAUDE.md has the gotchas. README has enough. Just delete all 4 files. | |

**User's choice:** Keep useful bits in README (Recommended)

---

## Claude's Discretion

- README section structure and formatting
- Whether Morgan require paths need changes (they shouldn't since files move together)
- How to handle root jest.config.js (move to apps/morgan/)

## Deferred Ideas

None — discussion stayed within phase scope
