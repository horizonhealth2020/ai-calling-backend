# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- TypeScript API route files: kebab-case (`sales.ts`, `call-audits.ts`, `change-requests.ts`, `cs-reps.ts`, `ai-budget.ts`) in `apps/ops-api/src/routes/`
- TypeScript API services: camelCase (`payroll.ts`, `auditQueue.ts`, `repSync.ts`, `agentKpiAggregator.ts`) in `apps/ops-api/src/services/`
- TypeScript test files: kebab-case with domain prefix (`commission.test.ts`, `payroll-guard.test.ts`, `status-change.test.ts`)
- Next.js page components: PascalCase matching their role (`PayrollPeriods.tsx`, `ManagerEntry.tsx`, `OwnerConfig.tsx`, `CSTracking.tsx`)
- Next.js route files: lowercase (`page.tsx`, `layout.tsx`, `error.tsx`)
- Root Morgan service: camelCase JS files (`index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`, `timeUtils.js`)

**Functions:**
- camelCase for all functions: `calculateCommission`, `upsertPayrollEntryForSale`, `handleCommissionZeroing`
- Handler wrappers: verb-noun pattern (`asyncHandler`, `requireAuth`, `requireRole`)
- Pure helpers: verb-noun (`computeTrend`, `shiftRange`, `buildPeriodSummary`, `formatDollar`, `logAudit`)
- Event emitters: `emit` prefix (`emitSaleChanged`, `emitCSChanged`)

**Variables:**
- camelCase for runtime values: `weekStart`, `weekEnd`, `mockFindMany`
- SCREAMING_SNAKE_CASE for module-level style constants in React files: `CARD`, `BTN`, `LBL`, `INP`, `FIELD`, `PREVIEW_PANEL`, `SMALL_INP`
- SCREAMING_SNAKE_CASE for numeric/string constants: `ENROLLMENT_BONUS_THRESHOLD`, `ENROLLMENT_BONUS_AMOUNT`, `TIMEZONE`, `MAX_SIZE`
- Short aliases for frequently used UI tokens: `const C = colors`, `const S = spacing`, `const R = radius`
- Zod schemas declared inline as `const schema = z.object({...})` at handler scope, or as module-level `const chargebackSchema = z.object({...})` when reused

**Types:**
- PascalCase for all types and interfaces: `AppRole`, `SessionUser`, `SaleWithProduct`, `TransitionResult`
- `type` keyword preferred over `interface` for data shapes
- `interface` used only for augmenting third-party types (Express `Request` extension in `apps/ops-api/src/middleware/auth.ts`) and for component props (`ManagerEntryProps`)
- Union string types for enums: `type AppRole = "SUPER_ADMIN" | "OWNER_VIEW" | ...`
- Inline type aliases in page components for API response shapes: `type Agent = { id: string; name: string; ... }`

## Code Style

**Formatting:**
- No Prettier or ESLint config files — formatting is convention-by-example
- 2-space indentation throughout TypeScript and TSX files
- Double quotes for strings in TypeScript/TSX (`"use client"`, `{ error: "Unauthorized" }`)
- Single quotes in root JS test files
- Trailing commas present in multi-line object/array literals

**Linting:**
- TypeScript strict mode enabled in `tsconfig.base.json` (`"strict": true`)
- No runtime linter (ESLint/Biome) config files
- `skipLibCheck: true` in base tsconfig

## Import Organization

**Order (consistent across all files):**
1. Third-party packages (`express`, `zod`, `lucide-react`, `recharts`)
2. Internal `@ops/*` workspace packages (`@ops/db`, `@ops/auth`, `@ops/types`, `@ops/ui`, `@ops/utils`)
3. Relative local imports (`../middleware/auth`, `../services/payroll`, `./helpers`)

**Path Aliases (defined in `tsconfig.base.json`):**
- `@ops/db` -> `packages/db/src`
- `@ops/auth` -> `packages/auth/src`
- `@ops/auth/client` -> `packages/auth/src/client` (separate entry point, not re-exported from index)
- `@ops/types` -> `packages/types/src`
- `@ops/utils` -> `packages/utils/src`
- `@ops/ui` -> `packages/ui/src`
- `@/` -> Next.js app-local alias (e.g., `@/lib/SocketProvider`)

## API Route Patterns

**Route file structure (Express):**
Each domain gets its own route file in `apps/ops-api/src/routes/`:
```typescript
// apps/ops-api/src/routes/sales.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

router.post("/sales", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ ... });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(zodErr(result.error));
  // ... business logic ...
  res.json(created);
}));

export default router;
```

**Route registration:** All route files are imported and mounted in `apps/ops-api/src/routes/index.ts` via `router.use(routeModule)`.

**Validation:** Always use Zod `safeParse` + `zodErr()` wrapper. Never use `parse()` (which throws). The `zodErr()` helper in `apps/ops-api/src/routes/helpers.ts` ensures responses always have `{ error: string, details: object }`.

**Auth middleware chain:** `requireAuth` -> `requireRole("ROLE1", "ROLE2")`. SUPER_ADMIN bypasses all role checks.

**Response format:**
- Success: `res.json(data)` or `res.json({ success: true, ... })`
- Validation error: `res.status(400).json(zodErr(result.error))`
- Auth error: `res.status(401).json({ error: "Unauthorized" })` or `res.status(403).json({ error: "Forbidden" })`
- Not found: `res.status(404).json({ error: "Not found" })`
- Conflict: `res.status(409).json({ error: "..." })` (Prisma P2002 unique constraint)

## Error Handling

**API Layer (Express):**
- All async route handlers wrapped with `asyncHandler()` from `apps/ops-api/src/routes/helpers.ts`:
  ```typescript
  export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
  ```
- Zod validation errors always returned via `zodErr()` helper:
  ```typescript
  export function zodErr(ze: z.ZodError) {
    const flat = ze.flatten();
    const msg = flat.formErrors[0] || Object.values(flat.fieldErrors).flat()[0] || "Validation failed";
    return { error: msg, details: flat };
  }
  ```
- Prisma unique constraint violations caught by error code: `if (e.code === "P2002") return res.status(409).json({ error: "..." })`
- Dashboard error fallback pattern: `` `Request failed (${res.status})` `` — always include HTTP status code, never a generic string

**Frontend (Next.js/React):**
- `authFetch()` from `@ops/auth/client` used for all authenticated API calls — injects Bearer header, 30s timeout
- Error state stored in component-local `useState` (`const [err, setErr] = useState<string | null>(null)`)
- Errors displayed inline, never swallowed silently

**Services (background):**
- Audit logging wrapped in try/catch; failures are logged but never throw (`apps/ops-api/src/services/audit.ts`)
- Queue processors use `console.error("[serviceName] ...")` with bracketed prefix

## Logging

**Framework:** `console.log` / `console.error` (primary), `@ops/utils` `logEvent`/`logError` (structured JSON, underused)

**Patterns:**
- Structured JSON for business events: `console.log(JSON.stringify({ event, payload, ts }))`
- Bracketed service prefix for background processes: `[auditQueue]`, `[audit]`, `[socket.io]`
- `@ops/utils` exports `logEvent(event, payload)` and `logError(event, payload)` — use these for new code

## Comments

**When to Comment:**
- Inline comments explaining business rules: `// enrollment fee >= this threshold -> no halving`
- Section dividers in test files: `// =============================================` with spec IDs
- JSDoc on exported service functions explaining domain logic
- Section headers in components: `/* -- Types -- */`, `/* -- Style constants -- */`, `/* -- Nav items -- */`

**JSDoc/TSDoc:**
- Used selectively on exported utility functions and client-side auth helpers
- Not used on React component props or Express route handlers

## Function Design

**Size:** Service functions stay focused; multi-step logic broken into helper functions

**Parameters:** Optional overrides via `Partial<T>` spread for test factories; service functions use explicit named parameters

**Return Values:**
- Services return typed objects or primitives
- Route handlers use early `return res.status(N).json(...)` for guard clauses; no nested if-else chains
- Pure helpers return explicit typed objects: `{ weekStart, weekEnd }`, `{ value, direction }`

## Module Design

**Exports:**
- Named exports only in service/utility files
- React page components use default export (Next.js convention)
- Packages expose named exports from `src/index.ts` barrel

**Barrel Files:**
- Each `packages/*/src/index.ts` is a barrel re-exporting the package's public API
- `@ops/auth/client` is a separate entry point, not re-exported from `@ops/auth` index

## React/UI Conventions

**Styling:**
- Inline `React.CSSProperties` objects only — no Tailwind, no CSS modules, no global stylesheets
- Style constants declared at module scope as SCREAMING_SNAKE_CASE before component definition:
  ```typescript
  const LBL: React.CSSProperties = { ...baseLabelStyle };
  const PREVIEW_PANEL: React.CSSProperties = {
    background: colors.bgSurface,
    border: "1px solid rgba(20,184,166,0.15)",
    borderRadius: radius.xl,
    padding: spacing[6],
  };
  ```
- Design tokens from `@ops/ui`: `colors`, `spacing`, `radius`, `shadows`, `typography`, `motion`
- Base style objects from `@ops/ui` extended via spread: `{ ...baseLabelStyle }`, `{ ...baseInputStyle }`, `{ ...baseButtonStyle }`
- Dark glassmorphism theme with gradient accents — always follow this aesthetic

**Component Structure (file order):**
1. `"use client"` directive
2. React/third-party imports
3. `@ops/*` package imports
4. Local relative imports
5. Type definitions block (`/* -- Types -- */`)
6. Constants (API URL, intervals)
7. Style constant block
8. Component function(s)

**Data Fetching:**
- All API calls use `authFetch(url)` from `@ops/auth/client`
- Token stored in `localStorage` as `ops_session_token`
- Fetching done in `useEffect` or `useCallback`, results stored in `useState`
- Loading state: `const [loading, setLoading] = useState(true)`
- API base URL: `const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? ""`

**Shared Components:**
- `PageShell` from `@ops/ui` provides sidebar/topbar navigation shell
- `@ops/ui` exports primitives: `Badge`, `Button`, `Input`, `Select`, `Card`, `TabNav`, `AnimatedNumber`, `ProgressRing`, `EmptyState`, `SkeletonCard`, `SkeletonLine`, `SkeletonTable`, `ThemeToggle`, `ToastProvider`
- Icons from `lucide-react` exclusively

---

*Convention analysis: 2026-03-24*
