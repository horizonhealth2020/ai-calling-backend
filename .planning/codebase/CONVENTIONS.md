# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- TypeScript API services: camelCase (`payroll.ts`, `auditQueue.ts`, `repSync.ts`)
- TypeScript test files: kebab-case with domain prefix (`commission.test.ts`, `payroll-guard.test.ts`, `status-change.test.ts`)
- Next.js page components: PascalCase matching their route segment (`PayrollPeriods.tsx`, `ManagerEntry.tsx`, `OwnerKPIs.tsx`)
- Next.js route files: lowercase (`page.tsx`, `layout.tsx`, `error.tsx`)

**Functions:**
- camelCase for all functions: `calculateCommission`, `upsertPayrollEntryForSale`, `handleCommissionZeroing`
- Handler wrappers: verb-noun pattern (`asyncHandler`, `requireAuth`, `requireRole`)
- Pure helpers: verb-noun (`computeTrend`, `shiftRange`, `buildPeriodSummary`, `formatDollar`, `logAudit`)

**Variables:**
- camelCase for runtime values: `weekStart`, `weekEnd`, `mockFindMany`
- SCREAMING_SNAKE_CASE for module-level style constants in React files: `CARD`, `BTN`, `LBL`, `INP`, `FIELD`, `PREVIEW_PANEL`, `SMALL_INP`
- SCREAMING_SNAKE_CASE for numeric/string constants: `ENROLLMENT_BONUS_THRESHOLD`, `ENROLLMENT_BONUS_AMOUNT`, `TIMEZONE`, `MAX_SIZE`
- Short aliases for frequently used tokens inside components: `const C = colors`, `const S = spacing`, `const R = radius`
- Zod schemas declared inline as `const schema = z.object({...})` at handler scope

**Types:**
- PascalCase for all types and interfaces: `AppRole`, `SessionUser`, `SaleWithProduct`, `TransitionResult`
- `type` keyword preferred over `interface` for data shapes
- `interface` used only for augmenting third-party types (Express `Request` extension in `apps/ops-api/src/middleware/auth.ts`)
- Union string types for enums: `type AppRole = "SUPER_ADMIN" | "OWNER_VIEW" | ...`

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected — formatting is convention-by-example
- 2-space indentation throughout TypeScript and TSX files
- Double quotes for strings in TypeScript/TSX (`"use client"`, `{ error: "Unauthorized" }`)
- Single quotes in Jest mock calls and some test strings
- Trailing commas present in multi-line object/array literals

**Linting:**
- TypeScript strict mode enabled in `tsconfig.base.json` (`"strict": true`)
- No runtime linter (ESLint/Biome) config files detected
- `skipLibCheck: true` in base tsconfig

## Import Organization

**Order (observed in `apps/ops-api/src/routes/index.ts` and component files):**
1. Third-party packages (`express`, `bcrypt`, `zod`, `lucide-react`)
2. Internal `@ops/*` workspace packages (`@ops/db`, `@ops/auth`, `@ops/types`, `@ops/ui`, `@ops/utils`)
3. Relative local imports (`../middleware/auth`, `../services/payroll`, `./lib/auth`)

**Path Aliases:**
- `@ops/db` → `packages/db/src`
- `@ops/auth` → `packages/auth/src`
- `@ops/auth/client` → `packages/auth/src/client`
- `@ops/types` → `packages/types/src`
- `@ops/utils` → `packages/utils/src`
- `@ops/ui` → `packages/ui/src`
- `@/` → Next.js app-local alias (e.g., `@/lib/auth`)
- Aliases defined in `tsconfig.base.json` and replicated per-app for Next.js `transpilePackages`

## Error Handling

**API Layer (Express):**
- All async route handlers wrapped with `asyncHandler()` defined in `apps/ops-api/src/routes/index.ts`:
  ```typescript
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
  ```
- Zod validation errors always returned via `zodErr()` helper to ensure `{ error, details }` shape:
  ```typescript
  function zodErr(ze: z.ZodError) {
    const flat = ze.flatten();
    const msg = flat.formErrors[0] || Object.values(flat.fieldErrors).flat()[0] || "Validation failed";
    return { error: msg, details: flat };
  }
  ```
- Prisma unique constraint violations caught by error code: `if (e.code === "P2002") return res.status(409).json({ error: "..." })`
- Auth errors return `{ error: "Unauthorized" }` (401) or `{ error: "Forbidden" }` (403)
- Global Express error handler in `apps/ops-api/src/index.ts` catches everything else; uses `err.statusCode` or `err.status` fallback to 500
- Dashboard error fallback pattern: `` `Request failed (${res.status})` `` — always include HTTP status code, never a generic string

**Frontend (Next.js/React):**
- `authFetch()` from `@ops/auth/client` used for all authenticated API calls — injects Bearer header, 30s timeout
- Error state stored in component-local `useState` (`const [err, setErr] = useState<string | null>(null)`)
- Errors displayed inline, never swallowed silently

**Services (background):**
- Audit logging wrapped in try/catch; failures are logged but never throw: `// Audit logging should never break the request`
- Queue processors use `console.error("[auditQueue] ...")` with bracketed service prefix for traceability

## Logging

**Framework:** `console.log` / `console.error` (no structured logger imported from `@ops/utils` in API routes despite `logEvent`/`logError` existing in the package)

**Patterns:**
- Structured JSON for business events: `console.log(JSON.stringify({ event: "...", ... }))`
- Bracketed service prefix for background processes: `[auditQueue]`, `[audit]`, `[socket.io]`
- `console.error` for all error conditions; `console.log` for info/connection events
- `@ops/utils` exports `logEvent` and `logError` (structured JSON) but these are used in frontend utilities like `formatDollar`, `formatDate` — not consistently used in API routes

## Comments

**When to Comment:**
- JSDoc-style block comments on exported service functions explaining domain logic (e.g., commission calculation in `apps/ops-api/src/services/payroll.ts`)
- Inline comments explaining business rules inside calculations: `// enrollment fee >= this threshold -> no halving`
- Section dividers in test files using `// ===...===` banners with spec IDs (e.g., `// COMM-01: Core + Compass VAB = full rate`)
- Constants block: `/** Enrollment fee >= this threshold triggers the enrollment bonus */`
- Route comments: single-line `/** ... */` above helper functions at file scope

**JSDoc/TSDoc:**
- Used selectively on exported utility functions in services
- Not used on React component props or Express route handlers

## Function Design

**Size:** Service functions stay focused; commission calculation broken into `applyEnrollmentFee()` helper + main `calculateCommission()` — each fits in one screen

**Parameters:** Optional overrides via `Partial<T>` spread for test factory functions; service functions use explicit named parameters

**Return Values:**
- Services return typed objects or primitives (never `any` in public signatures)
- Route handlers use early `return res.status(N).json(...)` for guard clauses; no nested if-else chains
- Pure helpers return explicit typed objects: `{ weekStart, weekEnd }`, `{ value, direction }`

## Module Design

**Exports:**
- Named exports only — no default exports in service/utility files
- React page components use default export (Next.js convention): `export default function PayrollPeriodsPage()`
- Packages expose named exports from `src/index.ts` barrel

**Barrel Files:**
- Each `packages/*/src/index.ts` is a barrel re-exporting the package's public API
- `@ops/auth/client` is a separate entry point (`packages/auth/src/client.ts`), not re-exported from `index.ts`

## React/UI Conventions

**Styling (all UI):**
- Inline `React.CSSProperties` objects only — no Tailwind, no CSS modules, no global stylesheets
- Style constants declared at module scope as SCREAMING_SNAKE_CASE constants before component definition
- Design tokens consumed from `@ops/ui` (`colors`, `spacing`, `radius`, `shadows`, `typography`, `motion`)
- Base style objects from `@ops/ui` extended via spread: `const LBL: React.CSSProperties = { ...baseLabelStyle }`

**Component structure:**
1. `"use client"` directive (if applicable)
2. React/third-party imports
3. `@ops/*` package imports
4. Local relative imports
5. Type definitions block (`/* -- Types -- */`)
6. Style constant block (`/* -- Style constants -- */`)
7. Component function

**Data fetching:**
- All API calls use `authFetch()` from `@ops/auth/client`; token stored in `localStorage` as `ops_session_token`
- Fetching done in `useEffect` or `useCallback`, results stored in `useState`
- Loading state tracked separately: `const [loading, setLoading] = useState(true)`

---

*Convention analysis: 2026-03-23*
