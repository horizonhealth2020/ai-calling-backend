# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- Kebab-case for Node.js files: `voiceGateway.js`, `rateLimitState.js`, `timeUtils.js`
- PascalCase for React components: `PageShell`, `Badge`, `AnimatedNumber` in `packages/ui/src/`
- Lowercase with optional dots for Next.js pages and routes: `page.tsx`, `layout.tsx`, `error.tsx`
- Index files: `index.ts` (exports from packages), `index.js` (main entry)

**Functions:**
- camelCase for all functions: `startOutboundCall()`, `normalizeToE164()`, `getFreeMorganSlotId()`, `upsertPayrollEntryForSale()`
- Async functions explicitly named: `asyncHandler()`, async route handlers in `apps/ops-api/src/routes/index.ts`
- Helper functions prefixed with intent: `getNextVapiPhoneNumberId()`, `getAssistantIdForAgent()`, `getMemberIdValue()`

**Variables:**
- camelCase for all variables: `morganQueue`, `morganQueuedIds`, `vapiPhoneNumberIds`, `enrollmentBonus`
- UPPER_SNAKE_CASE for constants and environment-derived values: `LOG_LEVEL`, `LOG_LEVELS`, `CONVOSO_AUTH_TOKEN`, `VAPI_API_KEY`, `MORGAN_MAX_CONCURRENT`, `MAX_QUEUED_IDS`
- Descriptive names for data structures: `morganSlots` (Map), `morganCallToSlot` (Map), `morganQueuedIdsTimestamps` (Map)

**Types:**
- PascalCase for TypeScript types and interfaces: `AppRole`, `SessionUser`, `SaleWithProduct`, `CallAudit`, `TrackerEntry`
- Enums in UPPER_SNAKE_CASE: `SUPER_ADMIN`, `OWNER_VIEW`, `MANAGER`, `PAYROLL`, `SERVICE`, `ADMIN` (from `@ops/types`)
- Type aliases match domain: `Tab = "entry" | "tracker" | "sales" | "audits" | "config"` in components

## Code Style

**Formatting:**
- No formatting tool enforced (no .eslintrc, .prettierrc, or biome.json detected)
- Manual consistency observed in existing code
- Line length varies; generally moderate
- Indentation: 2 spaces (Node.js), observed in test and source files

**Linting:**
- No ESLint or Biome configuration file present
- TypeScript strict mode enabled in `tsconfig.base.json`: `"strict": true`
- Developers follow implicit conventions observed in codebase rather than enforced rules

## Import Organization

**Order:**
1. Framework/runtime imports (`express`, `react`, `next`)
2. Third-party packages (`zod`, `bcryptjs`, `prisma`, `lucide-react`)
3. Relative imports from shared packages (`@ops/*` aliases)
4. Relative file imports (`./voiceGateway`, `../services/payroll`)

**Example from `apps/ops-api/src/routes/index.ts`:**
```typescript
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import { requireAuth, requireRole } from "../middleware/auth";
```

**Path Aliases:**
- `@ops/db` → `packages/db/src`
- `@ops/auth` → `packages/auth/src`
- `@ops/auth/client` → `packages/auth/src/client`
- `@ops/types` → `packages/types/src`
- `@ops/utils` → `packages/utils/src`
- `@ops/ui` → `packages/ui/src`
- Defined in `tsconfig.base.json` for workspace-wide resolution

## Error Handling

**Patterns:**
- Synchronous validation wrapped in `asyncHandler()` before returning to clients
- Zod errors normalized via `zodErr()` helper to ensure `{ error: string, details: object }` shape
- HTTP status codes used consistently: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 500+ (server errors)
- Promises always caught with `.catch(next)` in Express handlers
- Try-catch for specific error codes (e.g., Prisma `P2002` for unique constraint violations)

**Example from `apps/ops-api/src/routes/index.ts`:**
```typescript
function zodErr(ze: z.ZodError) {
  const flat = ze.flatten();
  const msg = flat.formErrors[0]
    || Object.values(flat.fieldErrors).flat()[0]
    || "Validation failed";
  return { error: msg, details: flat };
}

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
```

## Logging

**Framework:** `console` (no structured logging library in root or most apps)

**Patterns in `packages/utils/src/index.ts`:**
```typescript
export const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(JSON.stringify({ level: "info", event, payload, ts: new Date().toISOString() }));
};

export const logError = (event: string, payload: Record<string, unknown>) => {
  console.error(JSON.stringify({ level: "error", event, payload, ts: new Date().toISOString() }));
};
```

**Custom logger in root `index.js`:**
```javascript
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const logger = {
  error: (...args) => {
    if (LOG_LEVELS[LOG_LEVEL] >= LOG_LEVELS.error) console.error(...args);
  },
  // ... similar for warn, info, debug
};
```

- Logs as JSON for structured analysis
- Level control via `LOG_LEVEL` env var
- Audit logging captured via `logAudit()` in `apps/ops-api/src/services/audit.ts`

## Comments

**When to Comment:**
- Top of files explain purpose (e.g., `// index.js\n// Main Express backend...`)
- Inline comments explain non-obvious logic or temporary workarounds
- Function comments for complex algorithms (e.g., date range calculations, commission logic)
- Rarely used; code should be self-documenting

**JSDoc/TSDoc:**
- Minimal usage observed
- When used, document purpose, not signature: `/** Calculate commission for a single product in context of a sale. */`
- Function signature comments like `/** Format Zod errors so the response always includes an error key for dashboard display. */`

**Example from `apps/ops-api/src/routes/index.ts`:**
```typescript
/** Compute date‐range boundaries from a range query param. */
function dateRange(range?: string): { gte: Date; lt: Date } | undefined {
  // Implementation
}
```

## Function Design

**Size:**
- Small, focused functions: most are 10-50 lines
- Complex logic broken into named helpers (e.g., `calcProductCommission()`, `applyEnrollmentFee()`)
- Route handlers kept concise via middleware and service functions

**Parameters:**
- Accept objects for multiple related parameters (destructuring common)
- Example: `{ agentName, toNumber, metadata, callName }` in `startOutboundCall()`
- Prefer named parameters over positional args for clarity

**Return Values:**
- Explicit return type annotations in TypeScript: `function dateRange(range?: string): { gte: Date; lt: Date } | undefined`
- Consistent shape for API responses: `{ error: string, details?: object }` or `{ success: true, data: object }`
- Null/undefined explicit where applicable (not implicit)

## Module Design

**Exports:**
- Named exports for utility functions: `export const logEvent`, `export const requireAuth`
- Default export for React components and pages
- Single file per module concept (e.g., `audit.ts`, `payroll.ts` are service modules)

**Barrel Files:**
- Used in `packages/*/src/index.ts` to re-export all public APIs
- Example: `packages/auth/src/index.ts` exports `signSessionToken`, `buildSessionCookie`, etc.
- Client package: `packages/auth/src/client.ts` explicitly re-exported via path alias for browser-side code

## React Component Patterns

**Style System:**
- All styling via inline `React.CSSProperties` objects
- No Tailwind, no global CSS (except theme variables in `packages/ui/src/`)
- Style constants defined at module scope as `const CARD: React.CSSProperties = { ... }`
- Theming via exported objects: `colors`, `spacing`, `radius`, `shadows`, `typography` from `@ops/ui`

**Example from `apps/manager-dashboard/app/page.tsx`:**
```typescript
const CARD: React.CSSProperties = {
  background: colors.bgSurface,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.xl,
  padding: spacing[6],
};

const INP: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};
```

**Component Structure:**
- Hooks for state: `useState`, `useEffect` at component top
- Type definitions before component function (e.g., `type Tab = "entry" | "tracker"`)
- Props destructured in function signature
- Event handlers defined as arrow functions or use closures

**Type Definitions:**
- Types defined in same file where used
- Complex domain types grouped (e.g., all agent/sale/audit types in manager dashboard)

## Validation

**Framework:** Zod for all request validation

**Pattern from `apps/ops-api/src/routes/index.ts`:**
```typescript
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(ROLE_ENUM).min(1),
});
const parsed = schema.safeParse(req.body);
if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
```

**Rules:**
- Financial amounts always `.min(0)`
- Commission percentages `.min(0).max(100)`
- **Exception:** `adjustmentAmount` allows negative for chargebacks (no `.min(0)`)
- All Zod errors wrapped via `zodErr()` to ensure dashboard error display

---

*Convention analysis: 2026-03-14*
