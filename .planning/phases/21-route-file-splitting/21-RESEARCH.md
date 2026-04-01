# Phase 21: Route File Splitting - Research

**Researched:** 2026-03-24
**Domain:** Express.js route organization / code splitting
**Confidence:** HIGH

## Summary

Phase 21 is a pure refactor: split the 2750-line `apps/ops-api/src/routes/index.ts` monolith into focused domain modules using Express Router composition. The current file contains ~95 route handlers, 3 shared helper functions (zodErr, asyncHandler, dateRange), and inline Zod schemas.

The approach is well-understood Express.js pattern: each domain file exports a Router, a barrel `index.ts` mounts all sub-routers on the main router, and shared helpers live in a dedicated file. Socket.IO is already decoupled via a module-level singleton (`src/socket.ts`) so handlers import emit functions directly -- no need to pass `io` through routers.

**Primary recommendation:** Extract helpers first, then split domains one at a time, running tests after each split to catch import breakage immediately.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation decisions delegated to Claude.

### Claude's Discretion
- D-01: Group ~95 handlers into ~10-16 domain files by entity/feature area
- D-02: Extract shared helpers (zodErr, asyncHandler, dateRange, prisma imports) into a common helpers file
- D-03: Use Express Router composition -- each domain file exports a router, barrel index.ts mounts all sub-routers
- D-04: File naming and structure at Claude's discretion (research suggests kebab-case)
- D-05: Keep flat URL paths unchanged -- splitting is internal only
- D-06: All existing tests must pass without modification after the split

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPLIT-01 | Route file split into domain modules with shared helpers extracted | Architecture Patterns section defines the exact module structure, helper extraction, and Router composition pattern |
| SPLIT-02 | All existing endpoints function identically after split (zero behavior change) | Common Pitfalls section covers import chain breaks, middleware ordering, and verification strategy |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.19.2 | HTTP framework with Router | Already in use; Router() is the native composition unit |
| zod | ^3.23.8 | Request validation | Already in use; inline schemas stay with their route handlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/db (prisma) | workspace | Database client | Imported by every domain module that does DB queries |
| @ops/auth | workspace | JWT/session helpers | Imported by auth routes only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Express Router | express-promise-router | Adds dependency for marginal benefit; asyncHandler already solves the problem |
| Manual barrel | Auto-loader (glob import) | Over-engineered for 10-16 files; explicit mounting is clearer |

**Installation:**
No new dependencies required. This is a pure file reorganization.

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-api/src/routes/
  index.ts              # Barrel: imports all domain routers, mounts on main router, exports default
  helpers.ts            # zodErr, asyncHandler, dateRange (shared by all domain files)
  auth.ts               # /auth/login, /auth/logout, /auth/change-password, /auth/refresh, /session/me
  users.ts              # /users CRUD
  agents.ts             # /agents CRUD, /lead-sources CRUD
  products.ts           # /products CRUD, /state-availability
  sales.ts              # /sales CRUD, preview, status changes, commission
  payroll.ts            # /payroll-periods, /payroll-entries, mark-paid
  service.ts            # /service-agents, /service-payroll-entries, /service-settings
  webhooks.ts           # /webhooks/convoso
  call-audits.ts        # /call-recordings, /call-audits, /ai-audit
  change-requests.ts    # /status-change-requests, /edit-change-requests
  call-logs.ts          # /call-logs, /kpi
  chargebacks.ts        # /chargebacks CRUD
  cs-reps.ts            # /cs-reps, /cs-roster
  pending-terms.ts      # /pending-terms
  alerts.ts             # /alerts
  ai-budget.ts          # /ai-budget, /ai-scoring
  admin.ts              # /permissions, /storage-stats, agent KPIs
```

### Pattern 1: Domain Router Module
**What:** Each file creates its own Router, defines handlers, exports the router.
**When to use:** Every domain file follows this exact pattern.
**Example:**
```typescript
// apps/ops-api/src/routes/sales.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { zodErr, asyncHandler, dateRange } from "./helpers";
import { upsertPayrollEntryForSale, calculateCommission, getSundayWeekRange, resolveBundleRequirement } from "../services/payroll";
import { logAudit } from "../services/audit";
import { emitSaleChanged } from "../socket";

const router = Router();

router.get("/sales", requireAuth, asyncHandler(async (req, res) => {
  // ... existing handler code, unchanged
}));

// ... more handlers

export default router;
```

### Pattern 2: Barrel Index (Router Composition)
**What:** The barrel imports all domain routers and mounts them on a single parent router.
**When to use:** Once, in `routes/index.ts`.
**Example:**
```typescript
// apps/ops-api/src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import agentRoutes from "./agents";
import productRoutes from "./products";
import salesRoutes from "./sales";
import payrollRoutes from "./payroll";
import serviceRoutes from "./service";
import webhookRoutes from "./webhooks";
import callAuditRoutes from "./call-audits";
import changeRequestRoutes from "./change-requests";
import callLogRoutes from "./call-logs";
import chargebackRoutes from "./chargebacks";
import csRepRoutes from "./cs-reps";
import pendingTermRoutes from "./pending-terms";
import alertRoutes from "./alerts";
import aiBudgetRoutes from "./ai-budget";
import adminRoutes from "./admin";

const router = Router();

router.use(authRoutes);
router.use(userRoutes);
router.use(agentRoutes);
router.use(productRoutes);
router.use(salesRoutes);
router.use(payrollRoutes);
router.use(serviceRoutes);
router.use(webhookRoutes);
router.use(callAuditRoutes);
router.use(changeRequestRoutes);
router.use(callLogRoutes);
router.use(chargebackRoutes);
router.use(csRepRoutes);
router.use(pendingTermRoutes);
router.use(alertRoutes);
router.use(aiBudgetRoutes);
router.use(adminRoutes);

export default router;
```

**Key detail:** `router.use(subRouter)` with NO path prefix preserves the exact URL paths. The app already mounts at `/api` in `src/index.ts` (`app.use("/api", routes)`), so all paths remain identical.

### Pattern 3: Shared Helpers Module
**What:** Extract the three helper functions plus common imports into one file.
**When to use:** Once, as the first step before splitting any routes.
**Example:**
```typescript
// apps/ops-api/src/routes/helpers.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/** Format Zod errors so the response always includes an `error` key for dashboard display. */
export function zodErr(ze: z.ZodError) {
  const flat = ze.flatten();
  const msg = flat.formErrors[0]
    || Object.values(flat.fieldErrors).flat()[0]
    || "Validation failed";
  return { error: msg, details: flat };
}

/** Wrap async route handlers so errors are forwarded to Express error handler */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

/** Compute date-range boundaries from a `range` query param or custom from/to dates. */
export function dateRange(range?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  // ... exact existing implementation
}
```

### Anti-Patterns to Avoid
- **Path prefix on sub-router mount:** `router.use("/sales", salesRoutes)` would change all URLs from `/api/sales` to `/api/sales/sales`. Mount with NO prefix: `router.use(salesRoutes)`.
- **Circular imports:** Don't import between domain files. Each domain imports only from helpers, middleware, services, and socket.
- **Moving Zod schemas to a shared file:** Keep inline Zod schemas with their handlers. They are route-specific validation, not shared logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async error handling | Try/catch in every handler | `asyncHandler` wrapper (already exists) | Consistent, tested, less boilerplate |
| Route auto-discovery | Glob-based file loader | Explicit imports in barrel | Predictable ordering, IDE navigation, easy to debug |
| Zod error formatting | Manual error message extraction | `zodErr` helper (already exists) | Consistent API error shape across all routes |

## Common Pitfalls

### Pitfall 1: Import Path Breaks After Move
**What goes wrong:** Relative imports like `../middleware/auth` may break when files move from `routes/index.ts` to `routes/sales.ts` (same directory depth, so actually fine here -- but easy to get wrong).
**Why it happens:** Developers assume relative paths change when splitting.
**How to avoid:** The routes directory is flat, and all domain files are siblings of the old `index.ts`. Relative paths to `../middleware/`, `../services/`, and `../socket` remain identical. Only the helper imports change (from inline to `./helpers`).
**Warning signs:** TypeScript compilation errors immediately after splitting.

### Pitfall 2: Middleware Ordering Changes
**What goes wrong:** If sub-routers are mounted in a different order, Express evaluates routes differently. A catch-all or parameterized route (e.g., `/:id`) in one file could shadow routes in another.
**Why it happens:** Express evaluates routes in registration order.
**How to avoid:** Mount sub-routers in the same order as handlers appear in the original file. The current file has no catch-all routes, but order still matters for overlapping param patterns.
**Warning signs:** 404s on endpoints that previously worked.

### Pitfall 3: Helper Extraction Order
**What goes wrong:** If you split domain files before extracting helpers, every domain file duplicates zodErr/asyncHandler/dateRange inline.
**Why it happens:** Rushing to split without extracting shared code first.
**How to avoid:** Step 1 is ALWAYS extracting helpers.ts. Then split domains, each importing from helpers.

### Pitfall 4: Missing TypeScript Types on `req.user`
**What goes wrong:** The route file relies on `req.user!.id` which is set by `requireAuth` middleware. TypeScript may complain about `user` not existing on `Request`.
**Why it happens:** Express `Request` type augmentation may be declared in a single place.
**How to avoid:** Check where `Request` is augmented (likely in `middleware/auth.ts` or a `types.d.ts`). Ensure all domain files can see this augmentation.
**Warning signs:** `Property 'user' does not exist on type 'Request'` errors.

### Pitfall 5: Forgetting to Export Router as Default
**What goes wrong:** If a domain file uses `export const router` instead of `export default router`, the barrel import syntax breaks.
**Why it happens:** Inconsistent export style.
**How to avoid:** Use `export default router` in every domain file for consistency with the existing pattern.

## Code Examples

### Socket.IO Usage in Routes (No Changes Needed)
Socket.IO is already decoupled. The route file imports emit functions from `../socket`:
```typescript
import { emitSaleChanged, emitCSChanged } from "../socket";
```
These are module-level imports, not passed via constructor or middleware. Every domain file can import them directly. No architectural changes needed.

### How the App Mounts Routes (No Changes Needed)
```typescript
// src/index.ts line 36
app.use("/api", routes);
```
The app imports `routes` from `./routes` which resolves to `./routes/index.ts`. As long as the barrel file continues to `export default router`, the app entry point needs zero changes.

### Test Infrastructure (No Changes Needed)
Existing tests are in `apps/ops-api/src/services/__tests__/` and test service functions directly (not route handlers). They import from `../payroll`, `../audit`, etc. Since we are only splitting the routes file (not services), no test files need modification.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single route file | Domain-split Router modules | Express best practice since v4 | Smaller files, easier code review, fewer merge conflicts |
| Passing io instance to route handlers | Module singleton pattern | Common since Socket.IO v3+ | Eliminates prop-drilling through routers |

## Open Questions

1. **Exact domain grouping for edge cases**
   - What we know: The CONTEXT.md provides a clear domain mapping with line ranges
   - What's unclear: Some handlers at boundary lines (e.g., agent KPIs vs. call logs) may need judgment calls on grouping
   - Recommendation: Use the CONTEXT.md table as the primary guide; when in doubt, group by the entity the handler primarily operates on

2. **Whether `req.user` type augmentation is scoped**
   - What we know: `requireAuth` sets `req.user`, and the current monolith compiles fine
   - What's unclear: Whether the type declaration is file-scoped or project-scoped
   - Recommendation: Check for `declare` blocks in middleware/auth.ts or a `.d.ts` file during implementation; likely already project-scoped

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `npm run test:ops` |
| Full suite command | `npm test && npm run test:ops` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPLIT-01 | Route file split into domain modules with shared helpers | structural | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` (compilation check) | N/A -- structural requirement |
| SPLIT-02 | All existing endpoints function identically | regression | `npm run test:ops` | Yes -- 6 existing test files in `services/__tests__/` |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit -p apps/ops-api/tsconfig.json && npm run test:ops`
- **Per wave merge:** `npm test && npm run test:ops`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. The 6 service tests validate commission logic, payroll guards, period assignment, status changes, and reporting. Since the refactor is internal (no behavior change), TypeScript compilation + existing tests provide sufficient regression coverage.

## Sources

### Primary (HIGH confidence)
- **Direct code inspection** of `apps/ops-api/src/routes/index.ts` (2750 lines), `apps/ops-api/src/index.ts` (app entry), `apps/ops-api/src/socket.ts` (Socket.IO singleton)
- **Direct code inspection** of `apps/ops-api/jest.config.ts` and 6 existing test files
- **Express.js Router documentation** -- Router composition via `router.use(subRouter)` is a stable, well-documented Express 4.x pattern

### Secondary (MEDIUM confidence)
- **CONTEXT.md domain mapping** -- line ranges and handler counts from grep analysis performed during discussion phase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, pure Express Router pattern
- Architecture: HIGH -- pattern is well-established, code inspection confirms Socket.IO is already decoupled
- Pitfalls: HIGH -- based on direct code analysis of imports, middleware, and type augmentation patterns

**Research date:** 2026-03-24
**Valid until:** Indefinite (Express Router composition is a stable pattern)
