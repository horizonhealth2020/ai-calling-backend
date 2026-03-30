# Phase 31: Auth Stability Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 31-auth-stability-fix
**Areas discussed:** Affected user recovery, Login page flash

---

## Affected User Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-clear (Recommended) | Fix detects and clears expired tokens automatically — users just refresh and see login form. Zero manual action needed. | ✓ |
| Notify them first | Deploy fix + send them a message explaining the issue is resolved and to try logging in again | |

**User's choice:** Auto-clear (Recommended)
**Notes:** 3 affected users (nickd, jasmin, juan.a) will automatically recover on next visit. No server-side action needed.

---

## Login Page Flash

| Option | Description | Selected |
|--------|-------------|----------|
| Add loading state (Recommended) | Show a brief loading indicator while useEffect checks token — prevents form flash for returning users. Small change (add a `checking` boolean state). | ✓ |
| Skip — flash is fine | Form briefly appears then redirects. Not a big deal for an internal tool. | |

**User's choice:** Add loading state (Recommended)
**Notes:** Prevents the brief login form flash before redirect for returning users with valid tokens.

---

## Claude's Discretion

- Loading indicator design during token check
- Exact placement of expiry check in middleware
- Clock skew buffer amount

## Deferred Ideas

None — discussion stayed within phase scope.
