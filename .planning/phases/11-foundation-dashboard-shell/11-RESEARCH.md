# Phase 11: Foundation & Dashboard Shell - Research

**Researched:** 2026-03-17
**Domain:** Prisma schema extension, Next.js dashboard scaffolding, RBAC role addition
**Confidence:** HIGH

## Summary

Phase 11 is a foundation phase that requires four distinct operations: (1) adding two new Prisma models with migration SQL, (2) extending the AppRole enum with CUSTOMER_SERVICE, (3) scaffolding a new Next.js dashboard app following existing patterns exactly, and (4) wiring the auth portal to redirect customer_service users to the new dashboard.

All patterns are well-established in the codebase. Every existing dashboard follows the same structure: `"use client"` page.tsx, PageShell with sidebar nav, inline CSSProperties, authFetch for API calls. The new cs-dashboard should be a near-copy of manager-dashboard's scaffolding with two nav items instead of five.

**Primary recommendation:** Clone the manager-dashboard structure, strip to two tabs (Submissions/Tracking) with placeholder content, and follow every existing convention exactly -- no innovation needed.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- App directory: `apps/cs-dashboard`
- Port: 3014
- Add to ALLOWED_ORIGINS in ops-api CORS whitelist
- Add npm workspace script: `npm run cs:dev` -> localhost:3014
- Follow exact same next.config.js pattern as other dashboards (transpilePackages, conditional standalone output)
- Use PageShell sidebar nav (same pattern as manager/payroll/owner dashboards)
- Two nav items: "Submissions" and "Tracking"
- Submissions tab shows two separate Card sections (Chargebacks parser + Pending Terms parser) -- not nested tabs
- Tracking tab shows two sections (Chargebacks tracking + Pending Terms tracking) on one scrollable page
- AppRole enum value: `CUSTOMER_SERVICE` (follows existing UPPER_SNAKE convention)
- Add to `packages/types/src/index.ts` AppRole type union
- Add CUSTOMER_SERVICE entry to DASHBOARD_MAP in auth-portal landing page
- URL pattern: `http://localhost:3014/landing?session_token=...`

### Claude's Discretion
- Prisma model naming convention (PascalCase per existing pattern)
- Migration SQL file naming
- Exact field types for decimal columns (follow existing Decimal(12,2) pattern)
- Docker and Railway configuration additions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHEMA-01 | chargeback_submissions table with all specified fields | Prisma model + migration SQL patterns documented below |
| SCHEMA-02 | pending_terms table with all specified fields | Prisma model + migration SQL patterns documented below |
| ROLE-01 | New customer_service role in AppRole enum and RBAC middleware | AppRole type union extension + UserRole Prisma enum documented |
| DASH-01 | Customer Service dashboard app following existing patterns | Full dashboard scaffolding pattern documented |
| DASH-03 | Auth portal redirects customer_service to CS dashboard | DASHBOARD_MAP pattern and auth-portal env vars documented |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.3.9 | Dashboard framework | All dashboards use this exact version |
| React | 18.3.1 | UI library | Pinned across all apps |
| react-dom | 18.3.1 | React DOM | Pinned across all apps |
| @ops/ui | workspace:* | PageShell, Card, Button, tokens, theme | Shared component library |
| @ops/auth | workspace:* | Client-side auth (captureTokenFromUrl, authFetch) | Used by all dashboards |
| Prisma | (existing) | Schema + migrations | All DB changes go through Prisma |
| lucide-react | ^0.577.0 | Icons for nav items | Root dependency, available to all apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ^5.6.2 | Type safety | All apps use same version |
| @types/react | ^18.3.10 | React types | Dev dependency |
| @types/node | ^22.7.4 | Node types | Dev dependency |

**Installation:**
No new packages needed. The cs-dashboard package.json will reference workspace packages identical to other dashboards.

## Architecture Patterns

### New Dashboard App Structure
```
apps/cs-dashboard/
  app/
    layout.tsx          # RootLayout with Inter font, ThemeProvider, CSS imports
    page.tsx            # "use client" main page with PageShell, tab state, placeholder content
  next.config.js        # transpilePackages, conditional standalone, env passthrough
  package.json          # @ops/cs-dashboard, dev script port 3014
  tsconfig.json         # extends ../../tsconfig.base.json
```

### Pattern 1: Dashboard Page Structure
**What:** Single-file "use client" page with PageShell wrapper and tab-driven content
**When to use:** Every dashboard follows this pattern
**Example:**
```typescript
// Source: apps/manager-dashboard/app/page.tsx
"use client";
import { PageShell, Card, colors, spacing, ... } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type Tab = "submissions" | "tracking";

export default function CSDashboard() {
  const [tab, setTab] = useState<Tab>("submissions");

  useEffect(() => { captureTokenFromUrl(); }, []);

  const navItems = [
    { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
    { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
  ];

  return (
    <PageShell
      title="Customer Service"
      subtitle="Chargebacks & Pending Terms"
      navItems={navItems}
      activeNav={tab}
      onNavChange={(k) => setTab(k as Tab)}
    >
      {tab === "submissions" && <SubmissionsTab />}
      {tab === "tracking" && <TrackingTab />}
    </PageShell>
  );
}
```

### Pattern 2: Layout File
**What:** Standard Next.js app layout with theme provider and CSS imports
**Example:**
```typescript
// Source: apps/manager-dashboard/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@ops/ui";
import "@ops/ui/src/theme.css";
import "@ops/ui/src/animations.css";
import "@ops/ui/src/responsive.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = { title: "Customer Service" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
```

### Pattern 3: next.config.js
**What:** Standard Next.js config with transpilePackages and conditional standalone
**Example:**
```javascript
// Source: apps/manager-dashboard/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ops/ui", "@ops/auth"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_OPS_API_URL: process.env.NEXT_PUBLIC_OPS_API_URL || "http://localhost:8080",
  },
};
module.exports = nextConfig;
```

### Pattern 4: Prisma Migration SQL
**What:** Manual SQL migration files following YYYYMMDD_description naming
**Example:**
```sql
-- Source: prisma/migrations/20260317_add_agent_call_kpi/migration.sql
CREATE TABLE "chargeback_submissions" (
  "id" TEXT NOT NULL,
  -- ... columns ...
  CONSTRAINT "chargeback_submissions_pkey" PRIMARY KEY ("id")
);
```

### Pattern 5: DASHBOARD_MAP Entry in Auth Portal
**What:** Role-to-dashboard mapping in auth-portal landing page
**Example:**
```typescript
// Source: apps/auth-portal/app/landing/page.tsx
const DASHBOARD_MAP: Record<string, DashboardConfig> = {
  // ... existing entries ...
  CUSTOMER_SERVICE: {
    label: "Customer Service",
    description: "Chargebacks & pending terms management",
    url: process.env.CS_DASHBOARD_URL || "",
    color: "#f59e0b",  // amber for distinction
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    Icon: Headphones,  // or similar from lucide-react
  },
};
```

### Anti-Patterns to Avoid
- **Hardcoding `output: "standalone"` in next.config.js:** This breaks Railway deployments. Always use the conditional pattern.
- **Using `@ops/socket` unless needed:** The cs-dashboard does not need real-time updates in v1.1. Do not add socket dependency.
- **Creating API routes in the dashboard:** All API calls go through ops-api. The dashboard is purely a client-side app.
- **Using `NEXT_PUBLIC_*` in docker-compose environment section:** These must be build args, not runtime env vars.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar navigation | Custom nav component | `PageShell` from `@ops/ui` | Already handles active state, mobile responsiveness, styling |
| Auth token capture | Manual URL parsing | `captureTokenFromUrl()` from `@ops/auth/client` | Handles edge cases, stores in localStorage |
| Authenticated API calls | Manual fetch with headers | `authFetch()` from `@ops/auth/client` | Injects Bearer header, 30s timeout, auto-refresh |
| Theme/styling system | New CSS approach | `colors`, `spacing`, `radius` from `@ops/ui` tokens | Consistent dark glassmorphism theme |
| Role checking | Custom RBAC logic | `requireRole(...roles)` middleware | SUPER_ADMIN bypass built in |

**Key insight:** This phase is pure pattern replication. Every component and utility already exists. The only new code is the Prisma schema additions and placeholder tab content.

## Common Pitfalls

### Pitfall 1: Forgetting to Update Multiple Files for New Role
**What goes wrong:** Adding CUSTOMER_SERVICE to one place but missing others
**Why it happens:** The role is defined in three separate locations
**How to avoid:** Checklist: (1) `packages/types/src/index.ts` AppRole union, (2) `prisma/schema.prisma` UserRole enum, (3) auth-portal DASHBOARD_MAP
**Warning signs:** Role works in TypeScript but Prisma rejects it, or user logs in but sees no dashboard

### Pitfall 2: Forgetting to Add CS_DASHBOARD_URL to Auth Portal Config
**What goes wrong:** DASHBOARD_MAP entry has empty URL, clicking the card goes nowhere
**Why it happens:** The auth-portal next.config.js needs `CS_DASHBOARD_URL` env var passthrough
**How to avoid:** Add `CS_DASHBOARD_URL: process.env.CS_DASHBOARD_URL || "http://localhost:3014"` to auth-portal next.config.js env section
**Warning signs:** Dashboard card appears but opens a blank tab

### Pitfall 3: Port 3014 Not in ALLOWED_ORIGINS
**What goes wrong:** CORS errors when cs-dashboard tries to call ops-api
**Why it happens:** ops-api CORS whitelist doesn't include the new port
**How to avoid:** Add `http://localhost:3014` to ALLOWED_ORIGINS in both `.env.example` and `apps/ops-api/.env.example`
**Warning signs:** Browser console shows CORS preflight failures

### Pitfall 4: Migration SQL Not Matching Prisma Schema
**What goes wrong:** `prisma migrate deploy` fails or generates a drift warning
**Why it happens:** Hand-written SQL doesn't match what Prisma would generate
**How to avoid:** Use Prisma's column mapping conventions: `@map("snake_case")` in schema, matching `"snake_case"` in SQL. Use `TEXT` for id columns (cuid), `TIMESTAMP(3)` for DateTime, `DECIMAL(x,y)` for Decimal.
**Warning signs:** `prisma migrate diff` shows unexpected changes

### Pitfall 5: Missing Workspace Registration
**What goes wrong:** `npm install` doesn't recognize the new app
**Why it happens:** Root package.json has `"workspaces": ["apps/*", "packages/*"]` -- this should auto-detect, but package.json needs correct name
**How to avoid:** Use name `@ops/cs-dashboard` in the new package.json, matching the `@ops/` prefix convention

## Code Examples

### Prisma Schema: ChargebackSubmission Model
```prisma
// Source: Based on REQUIREMENTS.md SCHEMA-01 + existing Prisma patterns
model ChargebackSubmission {
  id                     String    @id @default(cuid())
  postedDate             DateTime? @map("posted_date")
  type                   String?
  payeeId                String?   @map("payee_id")
  payeeName              String?   @map("payee_name")
  payoutPercent          Decimal?  @db.Decimal(5, 2) @map("payout_percent")
  chargebackAmount       Decimal?  @db.Decimal(12, 2) @map("chargeback_amount")
  totalAmount            Decimal?  @db.Decimal(12, 2) @map("total_amount")
  transactionDescription String?   @map("transaction_description")
  product                String?
  memberCompany          String?   @map("member_company")
  memberId               String?   @map("member_id")
  memberAgentCompany     String?   @map("member_agent_company")
  memberAgentId          String?   @map("member_agent_id")
  submittedBy            String    @map("submitted_by")
  submittedAt            DateTime  @default(now()) @map("submitted_at")
  batchId                String    @map("batch_id")
  rawPaste               String    @map("raw_paste")
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  submitter User @relation("ChargebackSubmittedBy", fields: [submittedBy], references: [id])

  @@map("chargeback_submissions")
}
```

### Prisma Schema: PendingTerm Model
```prisma
// Source: Based on REQUIREMENTS.md SCHEMA-02 + existing Prisma patterns
model PendingTerm {
  id                  String    @id @default(cuid())
  agentName           String?   @map("agent_name")
  agentId             String?   @map("agent_id_field")
  memberId            String?   @map("member_id")
  memberName          String?   @map("member_name")
  city                String?
  state               String?
  phone               String?
  email               String?
  product             String?
  enrollAmount        Decimal?  @db.Decimal(12, 2) @map("enroll_amount")
  monthlyAmount       Decimal?  @db.Decimal(12, 2) @map("monthly_amount")
  paid                String?
  createdDate         DateTime? @map("created_date")
  firstBilling        DateTime? @map("first_billing")
  activeDate          DateTime? @map("active_date")
  nextBilling         DateTime? @map("next_billing")
  holdDate            DateTime? @map("hold_date") @db.Date
  holdReason          String?   @map("hold_reason")
  inactive            Boolean?  @default(false)
  lastTransactionType String?   @map("last_transaction_type")
  smoker              String?
  batchId             String    @map("batch_id")
  submittedBy         String    @map("submitted_by")
  submittedAt         DateTime  @default(now()) @map("submitted_at")
  rawPaste            String    @map("raw_paste")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  submitter User @relation("PendingTermSubmittedBy", fields: [submittedBy], references: [id])

  @@map("pending_terms")
}
```

### UserRole Enum Extension
```prisma
enum UserRole {
  SUPER_ADMIN
  OWNER_VIEW
  MANAGER
  PAYROLL
  SERVICE
  ADMIN
  CUSTOMER_SERVICE  // NEW
}
```

### AppRole Type Extension
```typescript
// packages/types/src/index.ts
export type AppRole = "SUPER_ADMIN" | "OWNER_VIEW" | "MANAGER" | "PAYROLL" | "SERVICE" | "ADMIN" | "CUSTOMER_SERVICE";
```

### Root package.json Script Addition
```json
"cs:dev": "npm --prefix apps/cs-dashboard run dev"
```

### Docker Compose Service Addition
```yaml
cs-dashboard:
  build:
    context: .
    dockerfile: Dockerfile.nextjs
    args:
      APP_NAME: cs-dashboard
      NEXT_PUBLIC_OPS_API_URL: ${OPS_API_URL:-http://localhost:8080}
  restart: unless-stopped
  depends_on:
    - ops-api
  ports:
    - "3014:3000"
```

### Auth Portal Updates
```javascript
// apps/auth-portal/next.config.js - add to env section:
CS_DASHBOARD_URL: process.env.CS_DASHBOARD_URL || "http://localhost:3014",
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | This is a greenfield addition following established patterns | N/A | No migration concerns |

**No deprecated patterns apply.** All existing patterns (Next.js 15, React 18, Prisma with manual migrations) are current.

## Important Notes on User Model Relations

The User model in `prisma/schema.prisma` will need two new relation fields added for the `submittedBy` FK on both new tables:

```prisma
model User {
  // ... existing fields ...
  chargebackSubmissions  ChargebackSubmission[] @relation("ChargebackSubmittedBy")
  pendingTermSubmissions PendingTerm[]          @relation("PendingTermSubmittedBy")
}
```

This is required by Prisma for the FK relation to compile. Without it, `prisma generate` will fail.

## Open Questions

1. **PendingTerm `agentId` field naming conflict**
   - What we know: The `agentId` field in PendingTerm refers to an external agent identifier from the pasted data, NOT a FK to the Agent model
   - What's unclear: Whether to name the Prisma field `agentIdField` with `@map("agent_id_field")` or just `agentId` with `@map("agent_id")`
   - Recommendation: Use `agentIdField` with `@map("agent_id_field")` to avoid any confusion with Prisma's Agent FK convention. The column name clearly indicates it's a data field, not a relation.

2. **holdDate as DATE-only type**
   - What we know: SCHEMA-02 specifies `hold_date as DATE only`
   - What's unclear: Prisma's `@db.Date` maps to PostgreSQL `DATE` type (no time component)
   - Recommendation: Use `DateTime? @map("hold_date") @db.Date` -- Prisma supports this and it stores date-only values

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | root jest.config (default) + `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="<pattern>" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 | chargeback_submissions table created with correct columns | manual-only | Verify via `npx prisma migrate deploy` + `npx prisma db pull` | N/A - migration SQL |
| SCHEMA-02 | pending_terms table created with correct columns | manual-only | Verify via `npx prisma migrate deploy` + `npx prisma db pull` | N/A - migration SQL |
| ROLE-01 | CUSTOMER_SERVICE in AppRole enum and Prisma UserRole | smoke | Verify TypeScript compilation: `npx tsc --noEmit -p packages/types/tsconfig.json` | N/A |
| DASH-01 | CS dashboard app loads with PageShell | smoke | `cd apps/cs-dashboard && npx next build` | Wave 0 |
| DASH-03 | Auth portal DASHBOARD_MAP includes CUSTOMER_SERVICE | smoke | `cd apps/auth-portal && npx next build` | Existing file modified |

### Sampling Rate
- **Per task commit:** `npx next build` in cs-dashboard to verify no build errors
- **Per wave merge:** `npm test` (root suite) + manual verification of migration
- **Phase gate:** `npx prisma migrate deploy` succeeds, cs-dashboard builds, auth-portal builds

### Wave 0 Gaps
- [ ] `apps/cs-dashboard/` -- entire app directory needs scaffolding
- [ ] `prisma/migrations/20260317_add_cs_tables/migration.sql` -- migration SQL
- [ ] No unit tests needed for this phase -- it's scaffolding + schema, verified by build and migration success

## Sources

### Primary (HIGH confidence)
- `packages/types/src/index.ts` -- AppRole type definition (direct codebase read)
- `prisma/schema.prisma` -- Existing schema patterns, UserRole enum, column types (direct codebase read)
- `apps/manager-dashboard/` -- Complete dashboard scaffolding pattern (direct codebase read)
- `apps/auth-portal/app/landing/page.tsx` -- DASHBOARD_MAP pattern (direct codebase read)
- `apps/ops-api/src/middleware/auth.ts` -- RBAC middleware behavior (direct codebase read)
- `docker-compose.yml` -- Docker service pattern (direct codebase read)

### Secondary (MEDIUM confidence)
- None needed -- all patterns verified from codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- exact versions and patterns read from existing code
- Architecture: HIGH -- cloning existing dashboard pattern with verified file structure
- Pitfalls: HIGH -- identified from actual codebase gotchas documented in CLAUDE.md and code review

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable patterns, no external dependency risk)
