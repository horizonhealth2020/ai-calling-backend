# Phase 26: Dead Code Removal - Research

**Researched:** 2026-03-25
**Domain:** Static analysis, code auditing, dependency management
**Confidence:** HIGH

## Summary

Dead code removal in this monorepo is a manual audit task across ~125 source files (41 in ops-api, 38 in ops-dashboard, 5 in sales-board, 13 in Morgan, 28 in packages). There is no ESLint configuration in the project, so the audit must be performed using grep-based searches and TypeScript compiler checks. The codebase is small enough that systematic manual auditing is reliable and faster than setting up tooling that would only be used once.

The key risk areas are: shared package exports (removing an export from `@ops/ui` or `@ops/types` that is consumed by any app), root `package.json` dependencies (some appear unused by Morgan), and the empty `apps/payroll-dashboard/` directory that survived Phase 25.

**Primary recommendation:** Audit by category (imports, then exports/functions, then commented-out code, then dependencies) across all apps and packages, using grep to verify every removal has zero call sites.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Include ALL code in the audit -- Ops Platform (ops-api, ops-dashboard, sales-board, packages/*) AND Morgan voice service (apps/morgan/)
- **D-02:** Morgan is included for dead code cleanup (imports, unused functions, commented-out code, unused deps) -- this is not a behavior change, just cleanup
- **D-03:** Do not affect how the system operates. This is purely removing dead weight before launch.
- **D-04:** Remove unused exports only if nothing in the codebase imports/calls them. If it's part of a working flow, leave it.
- **D-05:** Remove commented-out code blocks. Comments explaining "why" are fine; disabled code is not.
- **D-06:** Remove unused dependencies from package.json files -- if no source file imports the package, remove it.
- **D-07:** Remove unused imports across all files.
- **D-08:** Every removal must be verified to not break any existing functionality. Run tests after each batch of changes.
- **D-09:** Git history preserves everything -- anything removed can be recovered if needed.

### Claude's Discretion
- How to organize the audit (by app, by type of dead code, or by file)
- Whether to use tooling (ESLint unused rules, depcheck) or manual grep-based auditing
- Grouping of changes into commits (by app, by type, or by file)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DC-01 | Unused imports removed across all apps and packages | Grep-based audit of all import statements; TypeScript compiler `noUnusedLocals` as verification |
| DC-02 | Unreferenced functions, components, and exports removed | Cross-reference every export with grep across entire codebase; shared packages need special care |
| DC-03 | Commented-out code blocks removed | Regex scan for multi-line comment blocks containing code patterns (function calls, assignments, JSX) |
| DC-04 | Unused dependencies removed from package.json files | Compare each dependency name against import/require statements in that package's source tree |
</phase_requirements>

## Standard Stack

### Core (Audit Approach)
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `grep -rn` | Search for import/require/usage of any symbol | Available everywhere, precise, no setup |
| TypeScript compiler (`tsc --noEmit`) | Catch unused locals/imports in TS files | Already configured via tsconfig.base.json |
| Manual cross-reference | Verify export usage across workspace boundaries | More reliable than tooling for monorepo workspace:* links |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `npm ls` | Verify dependency tree after removals | After modifying any package.json |
| Jest (`npm test`) | Verify Morgan still passes after changes | After each Morgan commit |
| Jest (`npm run test:ops`) | Verify ops-api still passes after changes | After each ops-api commit |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual grep | ESLint `no-unused-vars` | No ESLint config exists; setting it up for a one-time audit is overhead |
| Manual dep audit | `depcheck` npm package | depcheck struggles with monorepo workspace:* links and transpilePackages |
| Manual export audit | `ts-prune` | ts-prune requires full TS project references setup which this repo lacks |

**Recommendation:** Use manual grep-based auditing. The codebase is only ~125 files. Setting up ESLint or depcheck for a one-time cleanup is not worth the effort. Grep is more reliable for this workspace layout.

## Architecture Patterns

### Audit Organization (Recommended: By Category)

Audit by dead-code category rather than by app. This ensures consistency and avoids re-scanning the same files multiple times.

```
Wave 1: Unused imports (DC-01)
  - All .ts/.tsx files in apps/ and packages/
  - All .js files in apps/morgan/

Wave 2: Unreferenced exports/functions (DC-02)
  - Shared packages first (packages/*)
  - Then app-internal functions (apps/*)

Wave 3: Commented-out code (DC-03)
  - All source files

Wave 4: Unused dependencies (DC-04)
  - Each package.json independently
```

### Shared Package Export Audit Pattern

For each export in a shared package, verify it has at least one consumer:

```bash
# Example: Check if Badge from @ops/ui is used anywhere
grep -rn "Badge" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "export.*Badge"
```

**Critical:** Shared packages are consumed via workspace:* links. An export in `packages/ui/src/components/index.ts` may be imported by any app. Always search the ENTIRE codebase, not just one app.

### Dependency Audit Pattern

For each dependency in a package.json:

```bash
# Example: Check if "bcryptjs" is imported in ops-api source
grep -rn "bcryptjs\|bcrypt" apps/ops-api/src/ --include="*.ts"
```

For root package.json, check against Morgan source files:

```bash
grep -rn "require.*lucide-react\|from.*lucide-react" apps/morgan/
```

### Anti-Patterns to Avoid
- **Removing re-exports without checking consumers:** `@ops/ui` re-exports from `./components`. Removing a component from the barrel file breaks all consumers even if the component file still exists.
- **Trusting TypeScript alone for JS files:** Morgan uses CommonJS JavaScript. TypeScript compiler won't check these files. Use grep.
- **Removing test-only imports:** Some imports exist only in test files. Verify test files are included in the search scope.
- **Batch-removing without incremental verification:** Remove one category at a time, test after each batch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding unused imports | Custom AST parser | grep + TypeScript compiler | 125 files is well within manual audit range |
| Finding unused deps | Custom package analyzer | Compare package.json keys against grep results | Simple key-by-key comparison works |
| Identifying commented code | Regex parser for all comment styles | Visual scan + simple regex | Commented-out code has obvious patterns (assignments, function calls in comments) |

**Key insight:** This is a one-time cleanup task. The codebase is small (~125 files). Simple tools applied systematically beat complex tooling that requires setup and configuration.

## Common Pitfalls

### Pitfall 1: Removing Workspace Package Exports That Are Used Cross-App
**What goes wrong:** An export from `@ops/types` or `@ops/ui` is removed because it appears unused in one app, but another app imports it.
**Why it happens:** Searching only within the package's own directory instead of the full monorepo.
**How to avoid:** ALWAYS search `apps/` AND `packages/` when checking if an export is used. Include all file extensions (.ts, .tsx, .js).
**Warning signs:** Removing an export from a `packages/*/src/index.ts` file.

### Pitfall 2: Root package.json Dependencies vs. Morgan Dependencies
**What goes wrong:** A dependency is removed from root package.json that Morgan actually uses at runtime.
**Why it happens:** Root package.json serves dual duty: workspace root AND Morgan's runtime dependencies.
**How to avoid:** For each root dependency, grep specifically in `apps/morgan/` source files. Morgan uses CommonJS `require()`, not ES imports.
**Warning signs:** Removing `axios`, `cors`, `express`, `luxon`, `node-cron`, `node-fetch` from root.

### Pitfall 3: Removing Type-Only Exports
**What goes wrong:** A type export (like `SessionUser`, `AppRole`, `DateRangeFilterValue`) is removed because grep doesn't find a runtime import.
**Why it happens:** TypeScript type imports may be elided at compile time but are essential for type checking.
**How to avoid:** Search for both `import { X }` and `import type { X }` patterns. Also search for inline type references like `: X` or `as X`.
**Warning signs:** Removing anything from `packages/types/src/`.

### Pitfall 4: Empty payroll-dashboard Directory
**What goes wrong:** The empty `apps/payroll-dashboard/` directory is left behind, or its removal is confused with dead code removal scope.
**Why it happens:** Phase 25 deleted the files but the empty directory persists.
**How to avoid:** Note: this directory is already empty (0 files). If it was supposed to be removed in Phase 25, flag it but still clean it up here since it's dead weight.

### Pitfall 5: Removing Dynamic Requires in Morgan
**What goes wrong:** A function appears unused by static grep but is called dynamically.
**Why it happens:** Morgan is plain JavaScript -- it could use dynamic requires or string-based function calls.
**How to avoid:** Read Morgan files carefully. At only 13 files and ~1,500 LOC, manual review is fast.
**Warning signs:** Any `require()` with a variable argument, or `module[name]` patterns.

### Pitfall 6: lucide-react and recharts in Root package.json
**What goes wrong:** These frontend dependencies exist in the root package.json but are NOT used by Morgan (the only root-level app).
**Why it happens:** They were likely added before the monorepo workspace structure was set up, or hoisted from a frontend app.
**How to avoid:** Verify: `lucide-react` is in `apps/ops-dashboard/package.json` as its own dependency. `recharts` is NOT listed in any app's package.json but may be used in dashboard code. Check carefully before removing from root.
**Current finding:** `lucide-react` (root) and `recharts` (root) are NOT imported anywhere in `apps/morgan/`. They should be verified against all frontend apps before removal.

## Code Examples

### Pattern: Verify an import is used in its file

```bash
# Find all files importing a specific symbol
grep -rn "import.*{.*ProgressRing" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# Find all files using require for a specific module (Morgan)
grep -rn "require.*axios" apps/morgan/
```

### Pattern: Find unused imports in a TypeScript file

```bash
# Use TypeScript compiler to detect unused locals
cd apps/ops-api && npx tsc --noEmit --noUnusedLocals 2>&1 | grep "declared but"
```

### Pattern: Find commented-out code blocks

```bash
# Find lines that look like commented-out code (assignments, function calls, JSX)
grep -rn "^\s*//\s*\(const\|let\|var\|return\|import\|export\|function\|await\|if\|for\|while\|<\)" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

### Pattern: Audit a package.json's dependencies

```bash
# For ops-api: check each dep
for dep in $(node -e "const p=require('./apps/ops-api/package.json'); Object.keys(p.dependencies||{}).forEach(d=>console.log(d))"); do
  count=$(grep -rn "$dep" apps/ops-api/src/ --include="*.ts" | grep -v node_modules | wc -l)
  if [ "$count" -eq 0 ]; then echo "UNUSED: $dep"; fi
done
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Install ESLint + config for one-time audit | Grep-based audit for small codebases | Always valid for <200 files | Skip tooling setup overhead |
| depcheck for dependency audit | Manual package.json key-by-key audit | depcheck unreliable with workspaces | More accurate for monorepos |

## Codebase Inventory (Pre-Audit Findings)

### Confirmed Used Dependencies
| Package.json | Dependency | Used In | Status |
|--------------|-----------|---------|--------|
| root | axios, cors, express | apps/morgan/index.js | USED |
| root | luxon | apps/morgan/timeUtils.js | USED |
| root | node-cron | apps/morgan/index.js | USED |
| root | node-fetch | apps/morgan/index.js, voiceGateway.js | USED |
| root | lucide-react | NOT in apps/morgan/ | SUSPECT -- verify frontend usage |
| root | recharts | NOT in apps/morgan/ | SUSPECT -- verify frontend usage |
| ops-api | bcryptjs | routes/auth.ts, routes/users.ts | USED |
| ops-api | @anthropic-ai/sdk | services/callAudit.ts | USED |
| ops-api | openai | services/callAudit.ts | USED |

### Shared Package Exports to Audit
| Package | Export Count | Risk |
|---------|-------------|------|
| @ops/ui | 16+ components + tokens + ThemeProvider | HIGH -- some components may be unused after v1.3 consolidation |
| @ops/types | AppRole, SessionUser, US_STATES, StateCode | LOW -- these are core types |
| @ops/auth | JWT sign/verify + client auth helpers | LOW -- core auth flow |
| @ops/socket | useSocket, event types, HIGHLIGHT_GLOW, DISCONNECT_BANNER | MEDIUM -- verify all exports have consumers |
| @ops/utils | logEvent, logError | LOW -- used everywhere |
| @ops/db | Prisma client singleton | LOW -- core data access |

### Known Dead Items (Pre-Research)
- `apps/payroll-dashboard/` -- empty directory, 0 files
- `lucide-react` in root package.json -- likely belongs only in ops-dashboard
- `recharts` in root package.json -- needs verification

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 |
| Config file (Morgan) | apps/morgan/jest.config.js |
| Config file (ops-api) | apps/ops-api/jest.config.ts |
| Quick run command (Morgan) | `npm test` |
| Quick run command (ops-api) | `npm run test:ops` |
| Full suite command | `npm test && npm run test:ops` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DC-01 | No unused imports across codebase | manual audit + tsc | `cd apps/ops-api && npx tsc --noEmit --noUnusedLocals` | N/A -- audit-based |
| DC-02 | Every export has a call site | manual audit | `grep -rn "EXPORT_NAME" apps/ packages/` per export | N/A -- audit-based |
| DC-03 | No commented-out code blocks | manual audit | Visual review + grep for comment patterns | N/A -- audit-based |
| DC-04 | Every dep in package.json is imported | manual audit | Per-dep grep against source tree | N/A -- audit-based |

### Sampling Rate
- **Per task commit:** `npm test && npm run test:ops` (verify no breakage)
- **Per wave merge:** Full test suite
- **Phase gate:** Full suite green + manual verification of all 4 requirements

### Wave 0 Gaps
None -- existing test infrastructure covers regression detection. Dead code removal does not require new tests; it requires existing tests to keep passing.

## Open Questions

1. **recharts in root package.json**
   - What we know: Not used by Morgan. May be used by ops-dashboard or sales-board.
   - What's unclear: Whether ops-dashboard imports recharts (it's not in ops-dashboard's own package.json, but npm workspace hoisting means it could resolve from root).
   - Recommendation: Grep for `recharts` across all frontend source files. If used, move to the correct app's package.json. If unused anywhere, remove entirely.

2. **lucide-react in root package.json**
   - What we know: ops-dashboard already has its own `lucide-react` dependency. Root copy is likely redundant.
   - What's unclear: Whether any root-level file or Morgan file uses it (unlikely).
   - Recommendation: Verify with grep, then remove from root if no root-level usage.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection via file reads and grep searches
- package.json files across all workspaces
- tsconfig.base.json for TypeScript configuration

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions from user discussion
- CLAUDE.md project instructions for architecture understanding

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- grep-based auditing is proven for this codebase size
- Architecture: HIGH -- audit-by-category pattern is standard practice
- Pitfalls: HIGH -- all pitfalls identified from actual codebase inspection
- Codebase inventory: MEDIUM -- pre-audit findings need full verification during implementation

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- dead code removal patterns don't change)
