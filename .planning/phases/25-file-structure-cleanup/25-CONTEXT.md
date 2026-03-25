# Phase 25: File Structure Cleanup - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the repository so Morgan lives in `apps/morgan/`, stale apps and docs are removed, and the root directory contains only monorepo configuration files. Zero behavior changes to any service.

</domain>

<decisions>
## Implementation Decisions

### Morgan Relocation
- **D-01:** Move all Morgan files (index.js, voiceGateway.js, morganToggle.js, timeUtils.js, rateLimitState.js) to `apps/morgan/`
- **D-02:** Update all relative require paths (`./voiceGateway` -> `./voiceGateway`, etc.) — paths stay the same since files move together, but test paths change from `../` to `./` or stay relative within `apps/morgan/`
- **D-03:** Move `__tests__/` to `apps/morgan/__tests__/` with `jest.config.js` — tests must update require paths from `../morganToggle` to `../morganToggle` (relative to new location)
- **D-04:** Keep Morgan dependencies in root `package.json` — do NOT split into separate package.json. Railway runs `npm install` from root and Morgan is working successfully. Minimizing risk is the priority.
- **D-05:** `railway.toml` and `nixpacks.toml` stay at repo root — update start command/paths to point to `apps/morgan/index.js` instead of `index.js`

### Stale App Removal
- **D-06:** Delete `apps/payroll-dashboard/` — empty directory, no files, no references anywhere. Superseded by unified `ops-dashboard` in v1.3.

### Root File Cleanup
- **D-07:** After Morgan files move out, root should contain only: package.json, package-lock.json, tsconfig.base.json, docker-compose.yml, Dockerfile.nextjs, railway.toml, nixpacks.toml, CLAUDE.md, README.md, prisma/, apps/, packages/, node_modules/, .planning/

### Doc Consolidation
- **D-08:** Merge useful content from FIXES.md, ISSUES.md, TESTING.md, and docs/railway-deploy.md into README.md:
  - Railway service mapping table (updated — remove stale standalone apps, add consolidated ops-dashboard)
  - Morgan known issues summary (19 open items from ISSUES.md — brief reference, not full reproduction)
  - Morgan test running instructions (brief)
  - Railway deployment crash prevention notes (already in CLAUDE.md "Known Gotchas" but useful in README for non-Claude users)
- **D-09:** Delete FIXES.md, ISSUES.md, TESTING.md, and docs/ directory after consolidation

### Claude's Discretion
- Exact README section structure and formatting — Claude should make it clean and professional
- Whether Morgan require paths need any changes (if files all move together, relative paths within the Morgan codebase stay the same)
- How to handle the root `jest.config.js` — move to `apps/morgan/` since it's Morgan's test config

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deployment Configuration
- `railway.toml` — Current Railway deployment config (needs path updates)
- `nixpacks.toml` — Nixpacks build config (needs path updates)
- `docker-compose.yml` — Docker orchestration (may need Morgan service path update)
- `Dockerfile.nextjs` — Shared Next.js Dockerfile (no changes expected)

### Morgan Voice Service
- `index.js` — Morgan entry point (moving to apps/morgan/)
- `voiceGateway.js` — Vapi outbound call logic
- `morganToggle.js` — Enable/disable toggle
- `timeUtils.js` — Business hours checker
- `rateLimitState.js` — Rate limit tracking
- `jest.config.js` — Jest config for Morgan tests
- `__tests__/` — All Morgan test files

### Stale Docs (to consolidate)
- `FIXES.md` — Historical fix documentation
- `ISSUES.md` — Morgan code audit (19 open issues)
- `TESTING.md` — Morgan testing guide
- `docs/railway-deploy.md` — Railway service mapping

### Monorepo Config (stays at root)
- `package.json` — Workspace config + Morgan deps
- `tsconfig.base.json` — Shared TypeScript config

</canonical_refs>

<code_context>
## Existing Code Insights

### Morgan File Dependencies
- `index.js` requires: `./voiceGateway`, `./morganToggle`, `./timeUtils`, `./rateLimitState`
- `voiceGateway.js` requires: `./morganToggle`, `./rateLimitState`
- All tests use `../` prefix to reach source files from `__tests__/`
- Since all files move together, internal require paths stay the same
- Test paths change: `require('../morganToggle')` stays the same pattern if `__tests__/` remains a sibling

### Root package.json
- Contains both workspace config (`workspaces: ["apps/*", "packages/*"]`) and Morgan's runtime deps
- Morgan's `npm start` script points to `node index.js` — needs update to `node apps/morgan/index.js`

### Railway Deployment
- Morgan deploys from root directory with `npm start`
- After move: start command changes to `node apps/morgan/index.js`
- All other Railway services deploy from their respective `apps/` directories

### Stale References
- `apps/payroll-dashboard/` is empty — just a directory shell
- `docs/railway-deploy.md` references 4 standalone apps that no longer exist

</code_context>

<specifics>
## Specific Ideas

- User emphasized: "WHATEVER IS BEST AS LONG AS IT DOESNT AFFECT HOW MORGAN REPO IS CURRENTLY OPERATING. ITS WORKING SUCCESSFULLY" — zero-risk approach to Morgan relocation
- User wants the repo to look "like a professional dev team created this"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-file-structure-cleanup*
*Context gathered: 2026-03-25*
