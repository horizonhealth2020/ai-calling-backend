# Conversion Optimization Reference

## Contents
- What "conversion" means in this platform
- Role-to-dashboard routing (the primary funnel)
- Auth error states that kill conversions
- Anti-patterns in role copy
- Missing analytics warning

---

## What "Conversion" Means Here

This is an internal ops platform — there's no checkout or signup funnel. "Conversion" means: **a user with the correct role successfully reaches the correct dashboard without friction**. Failed conversions are access-denied errors, wrong redirects, and confusing landing copy that makes users ping IT.

The funnel: `auth-portal login → role detection → dashboard selection → target dashboard`

---

## Role-to-Dashboard Routing

The `landing/page.tsx` in `apps/auth-portal` is the decision surface. It filters available dashboards by the user's `AppRole`. This is where copy must immediately confirm "you're in the right place."

```tsx
// apps/auth-portal/app/landing/page.tsx — role-filtered dashboard cards
// Each card needs: clear title, one-line description of the job to be done
const ROLE_DASHBOARDS: Record<AppRole, { title: string; description: string; href: string }[]> = {
  MANAGER: [
    {
      title: "Manager Dashboard",
      description: "Log sales, manage agents, review call audits, configure lead sources.",
      href: process.env.NEXT_PUBLIC_MANAGER_URL!,
    },
  ],
  PAYROLL: [
    {
      title: "Payroll Dashboard",
      description: "Run payroll periods, approve commissions, process chargebacks, export reports.",
      href: process.env.NEXT_PUBLIC_PAYROLL_URL!,
    },
  ],
  OWNER_VIEW: [
    {
      title: "Owner Dashboard",
      description: "Review KPIs, agent performance, and operational metrics.",
      href: process.env.NEXT_PUBLIC_OWNER_URL!,
    },
  ],
};
```

---

## Auth Error States That Kill Conversions

Two error pages exist. Both must tell users **what happened AND what to do next** — not just block.

```tsx
// apps/auth-portal/app/access-denied/page.tsx — GOOD pattern
<h1>Access Denied</h1>
<p>Your account role does not include access to this area.</p>
<p>Contact your administrator or return to <a href="/">dashboard selection</a>.</p>
```

```tsx
// apps/auth-portal/app/unauthorized/page.tsx — GOOD pattern
<h1>Session Expired</h1>
<p>Your session has expired. <a href="/login">Sign in again</a> to continue.</p>
```

### WARNING: Vague Error Copy

**The Problem:**
```tsx
// BAD — user has no idea what went wrong or what to do
<h1>Unauthorized</h1>
<p>You do not have access to this dashboard.</p>
```

**Why This Breaks:**
1. User doesn't know if their role is wrong, their session expired, or the URL is invalid
2. No recovery path — user closes the tab or contacts support unnecessarily
3. Increases IT/admin support tickets

**The Fix:** Distinguish between "wrong role" (`access-denied`) and "expired session" (`unauthorized`) with different copy and recovery CTAs.

---

## WARNING: Missing Analytics

**Detected:** No analytics library (no GTM, Mixpanel, Amplitude, Segment, or PostHog) in any `package.json`.

**Impact:** You cannot measure which roles fail to reach their dashboard, which error pages appear most, or whether copy changes improve task completion.

### Recommended Minimal Instrumentation

Add lightweight event logging for auth funnel events in `apps/auth-portal`:

```tsx
// apps/auth-portal/app/landing/page.tsx
// Fire on dashboard card click — can be a simple fetch to ops-api audit log
function trackDashboardSelect(role: string, target: string) {
  // POST to /api/audit or use logEvent from @ops/utils on the server side
  fetch(`${process.env.NEXT_PUBLIC_OPS_API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "dashboard_selected", role, target }),
  }).catch(() => {}); // fire-and-forget, never block navigation
}
```

See the **mapping-conversion-events** skill for full instrumentation patterns.

---

## Copy Audit Checklist

Copy this checklist when auditing role-facing copy:

- [ ] Login page headline communicates platform identity ("Horizon Health Operations")
- [ ] Dashboard selection cards have job-to-be-done descriptions (not just role names)
- [ ] Access-denied page offers a recovery path (link back or contact info)
- [ ] Unauthorized page distinguishes expired session from wrong role
- [ ] Empty states in each dashboard tell the user what action to take first
- [ ] Sales board headline matches the energy of the context (competitive leaderboard)
