# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- TypeScript source files use camelCase: `payroll.ts`, `callAudit.ts`, `auditQueue.ts`
- Test files use kebab-case with `.test.ts` or `.test.js` suffix: `commission.test.ts`, `payroll-guard.test.ts`
- Next.js pages follow App Router convention: `app/page.tsx`, `app/layout.tsx`, `app/error.tsx`
- Mock files use kebab-case: `ops-db.ts` inside `__mocks__/`

**Functions:**
- camelCase for all functions: `calculateCommission`, `getSundayWeekRange`, `logAudit`, `asyncHandler`
- Exported service functions are named after their action + subject: `upsertPayrollEntryForSale`, `handleCommissionZeroing`, `isAgentPaidInPeriod`
- Helper/utility functions inside route files use camelCase: `zodErr`, `dateRange`, `asyncHandler`

**Variables:**
- camelCase for runtime variables: `mockFindMany`, `weekStart`, `weekEnd`
- SCREAMING_SNAKE_CASE for module-level constants and style objects in React components: `API`, `DAYS`, `NAV_ITEMS`, `PREVIEW_PANEL`, `LBL`
- Short uppercase aliases for imported design token objects are common in frontend pages: `const C = colors`, `const S = spacing`, `const R = radius`

**Types and Interfaces:**
- PascalCase for all types: `SaleWithProduct`, `TransitionResult`, `SessionUser`, `AppRole`
- Intersection types for Prisma relations: `Sale & { product: Product; addons: ... }`
- Local types declared at top of file, below imports, above constants

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected — formatting is enforced by convention and TypeScript strict mode only
- Indentation: 2 spaces (observed throughout all `.ts` and `.tsx` files)
- Single quotes preferred in JS files; double quotes used in TS/TSX files

**TypeScript:**
- Strict mode enabled via `tsconfig.base.json`: `"strict": true`
- Target: `ES2022`, module resolution: `Node`, `esModuleInterop: true`
- Non-null assertions (`!`) used selectively for `req.user!` after auth middleware
- `any` is avoided but used in a few specific places for Prisma dynamic input: `metadata?: object`, `e: any` for Prisma error codes

## Import Organization

**Order (TypeScript files):**
1. Node/framework imports: `import express from "express"`, `import { z } from "zod"`
2. Shared package imports: `import { prisma } from "@ops/db"`, `import { requireAuth } from "../middleware/auth"`
3. Local service imports: `import { logAudit } from "../services/audit"`

**Order (React pages):**
1. `"use client"` directive (first line)
2. React and hook imports
3. Shared package imports (`@ops/ui`, `@ops/auth/client`, `@ops/socket`)
4. Icon imports from `lucide-react`
5. Module-level constant: `const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? ""`
6. Type declarations block (comment-separated)
7. Module-level style/config constants (comment-separated)

**Path Aliases:**
- `@ops/db` → `packages/db/src`
- `@ops/auth` → `packages/auth/src`
- `@ops/auth/client` → `packages/auth/src/client`
- `@ops/types` → `packages/types/src`
- `@ops/utils` → `packages/utils/src`
- `@ops/ui` → `packages/ui/src`
- Defined in `tsconfig.base.json` and mapped in `jest.config.ts` via `moduleNameMapper`

## Error Handling

**API routes (Express):**
- All async handlers wrapped with `asyncHandler()` which calls `.catch(next)` to forward to global error handler
- Zod validation errors always use `zodErr(parsed.error)` — never `.flatten()` directly — to ensure `{ error, details }` shape
- Prisma unique constraint violations caught explicitly: `if (e.code === "P2002") return res.status(409).json({ error: "..." })`
- Unknown errors re-thrown: `throw e` after handling known codes
- Global error handler in `apps/ops-api/src/index.ts` returns `{ error: message }` with appropriate status

**Frontend error display:**
- API calls check `res.ok`, then fall back to `` `Request failed (${res.status})` `` — never generic strings
- Error state from JSON is accessed as `err.error` (matches the `zodErr` shape)

**Service layer:**
- `logAudit` wraps DB write in `try/catch` — audit failures log to `console.error` but never throw
- `verifySessionToken` in `packages/auth/src/index.ts` returns `null` on any error (never throws)

## Logging

**Structured logging (`@ops/utils`):**
- `logEvent(event, payload)` — emits `{ level: "info", event, payload, ts }` as JSON to stdout
- `logError(event, payload)` — emits `{ level: "error", event, payload, ts }` as JSON to stderr
- Located in `packages/utils/src/index.ts`

**Direct console logging:**
- `console.error` used directly in `audit.ts` for fallback and `index.ts` server bootstrap
- `console.log` used in Socket.IO connection events in `apps/ops-api/src/index.ts`
- Structured `@ops/utils` loggers are preferred over raw console in service code

## Comments

**When to Comment:**
- Section separators in large files use `/* ── Section Name ───────────────────────────── */` pattern
- Test suites use `// =============================================` dividers with test ID labels (e.g., `// COMM-01: ...`)
- Inline comments explain non-obvious business logic: e.g., why halving occurs, fee thresholds

**JSDoc:**
- Used on public service functions in `apps/ops-api/src/services/payroll.ts`
- Format: block comment above function with description of algorithm steps
- Example:
```typescript
/**
 * Calculate commission for a sale using bundle aggregation logic.
 *
 * When a core product exists:
 *   1. Sum bundle premium = core premium + regular addon premiums
 *   ...
 */
```

## Function Design

**Size:**
- Service functions kept focused; complex orchestration functions (e.g., `upsertPayrollEntryForSale`) are the exception
- Pure helper functions extracted when they can be independently tested (e.g., `calculateCommission`, `getSundayWeekRange`, `computeTrend`)

**Parameters:**
- Object destructuring used for complex inputs
- Prisma model types used directly as function parameters with intersection types for relations

**Return Values:**
- Service functions return plain objects or primitives — no Express Response objects
- Routes use early return pattern: `if (!parsed.success) return res.status(400).json(...)`

## Module Design

**Exports:**
- Named exports only — no default exports in service files
- `packages/auth/src/index.ts` exports individual functions plus re-exports `SESSION_COOKIE` const

**Barrel Files:**
- `@ops/ui` exports all components, design tokens, and style helpers from a single entry point
- Individual packages export directly from `src/index.ts`

## React / Frontend Patterns

**Styling:**
- Inline `React.CSSProperties` objects only — no Tailwind, no CSS modules, no globals
- Style constants defined at module level with SCREAMING_SNAKE_CASE names: `PREVIEW_PANEL`, `LBL`, `BTN`
- Design tokens imported from `@ops/ui` and aliased locally: `const C = colors`, `const S = spacing`
- Base style objects from `@ops/ui` spread into local overrides: `{ ...baseInputStyle, marginBottom: 8 }`

**State:**
- `useState` and `useEffect` are the primary hooks; `useCallback` used for stable fetch functions
- `useRef` used for abort controllers and DOM refs
- No global state manager — each page manages its own state

**Data Fetching:**
- `authFetch()` from `@ops/auth/client` used for all authenticated API calls (injects Bearer header, 30s timeout)
- `captureTokenFromUrl()` called on mount to handle post-login redirect token
- `useCallback` wraps fetch functions to prevent unnecessary re-renders

---

*Convention analysis: 2026-03-17*
