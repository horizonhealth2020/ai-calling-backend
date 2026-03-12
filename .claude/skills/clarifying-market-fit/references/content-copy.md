# Content Copy Reference

## Contents
- Copy inventory by surface
- Voice and tone principles
- Role-specific copy patterns
- Anti-patterns in in-app copy
- Updating copy workflow

---

## Copy Inventory by Surface

| Surface | File | Copy Type |
|---------|------|-----------|
| Login page | `apps/auth-portal/app/page.tsx` | Platform headline, sign-in CTA |
| Dashboard selector | `apps/auth-portal/app/landing/page.tsx` | Role dashboard titles + descriptions |
| Access denied | `apps/auth-portal/app/access-denied/page.tsx` | Error + recovery |
| Unauthorized | `apps/auth-portal/app/unauthorized/page.tsx` | Session error + recovery |
| Sales board | `apps/sales-board/app/page.tsx` | Public leaderboard hero + stat labels |
| Manager dashboard | `apps/manager-dashboard/app/page.tsx` | Tab labels, empty states, form labels |
| Payroll dashboard | `apps/payroll-dashboard/app/page.tsx` | Period labels, approval copy, export labels |
| Owner dashboard | `apps/owner-dashboard/app/page.tsx` | KPI labels, summary copy |

All copy is **hardcoded in `.tsx` files** — there is no CMS, i18n layer, or content management system. Edits require direct file changes.

---

## Voice and Tone Principles

The platform serves health insurance sales operations. Users are professionals under time pressure. Copy must be:

- **Functional over friendly** — tell users what they can do, not how great the platform is
- **Role-specific** — a manager and a payroll admin have completely different jobs
- **Terse** — one line per description, no filler words
- **Action-oriented** — use verbs: "Log sales", "Run payroll", "Review KPIs"

---

## Role-Specific Copy Patterns

### MANAGER

```tsx
// Dashboard card description — focus on daily actions
description: "Log sales, manage agents, review call audits, configure lead sources."

// Tab label copy — short nouns for navigation
tabs: ["Sales Entry", "Agent Tracker", "Call Audits", "Config"]

// Empty state — tells what first action is
<p>No sales logged this week. Use the Sales Entry tab to add your first sale.</p>
```

### PAYROLL

```tsx
// Dashboard card description — focus on cycle management
description: "Run payroll periods, approve commissions, process chargebacks, export reports."

// Period status labels — must match the PayrollPeriod status enum
const STATUS_LABELS = {
  OPEN: "Open",
  LOCKED: "Locked — awaiting approval",
  PAID: "Paid",
};
```

### OWNER_VIEW / SUPER_ADMIN

```tsx
// Dashboard card description — focus on oversight
description: "Review KPIs, agent performance, and operational metrics across all managers."
```

### Sales Board (public)

```tsx
// Hero — competitive, energetic, present tense
<h1>Sales Arena</h1>
<p>Live Leaderboard · Updates every 30s</p>

// Stat labels — concise, no units in labels (units go in values)
"Today's Sales"   // value: "$4,200"
"Weekly Premium"  // value: "$18,500"
```

---

## WARNING: Generic Dashboard Descriptions

**The Problem:**
```tsx
// BAD — copy lifted from role enum names, tells users nothing
{ role: "MANAGER", description: "Manager dashboard" }
{ role: "PAYROLL", description: "Payroll dashboard" }
```

**Why This Breaks:**
1. A SUPER_ADMIN seeing both cards can't distinguish purpose at a glance
2. New employees don't know which dashboard covers their job
3. Creates support requests: "which one do I use?"

**The Fix:**
```tsx
// GOOD — job-to-be-done language
{ role: "MANAGER", description: "Log sales, manage agents, review call audits." }
{ role: "PAYROLL", description: "Run payroll periods, approve commissions, export reports." }
```

---

## WARNING: Passive Error Copy

**The Problem:**
```tsx
// BAD — tells user what happened but not what to do
<p>You do not have access to this dashboard.</p>
```

**Why This Breaks:** Users with wrong roles hit a dead end. They close the tab, call IT, or try random URLs. Passive copy doubles support burden.

**The Fix:**
```tsx
// GOOD — confirms what happened AND gives a path forward
<p>Your role doesn't include access to this dashboard.</p>
<p><a href="/">Return to dashboard selection</a> or contact your administrator.</p>
```

---

## Updating Copy Workflow

1. Identify the surface from the inventory table above
2. Read the target file: `apps/<app>/app/page.tsx` or the relevant sub-page
3. Locate the copy string (usually in JSX, not a constant)
4. Edit inline — copy strings are not extracted to constants in this codebase
5. Validate: `npm run <app>:dev` and visually confirm in browser
6. For role-gated copy, test with a user of each relevant role (seed users in `prisma/seed.ts`)

```bash
# Seed creates test users for each role with password ChangeMe123!
npm run db:seed
```

See the **designing-onboarding-paths** skill for copy patterns in first-run and empty states.
