---
status: diagnosed
trigger: "Investigate why a CUSTOMER_SERVICE user cannot log in, and why editing a user throws 'td is not defined' error on the manager dashboard."
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
---

## Current Focus

hypothesis: Both bugs confirmed via code reading — no further investigation needed.
test: N/A — root causes are directly observable in source code.
expecting: N/A
next_action: Apply fixes to owner-dashboard/app/page.tsx

## Symptoms

expected: CUSTOMER_SERVICE user can log in and reach CS dashboard; editing any user in owner-dashboard works without errors.
actual: CUSTOMER_SERVICE user login fails (lands on "No dashboards assigned" or blank); editing a user throws "TD is not defined" runtime error.
errors: "td is not defined" (JavaScript ReferenceError at runtime when edit form is rendered)
reproduction: Create user with CUSTOMER_SERVICE role -> attempt login; separately, open any user row for editing.
started: When CUSTOMER_SERVICE role was added (cs-dashboard phase)

## Eliminated

- hypothesis: Login fails in ops-api (auth/login route rejects CUSTOMER_SERVICE)
  evidence: ops-api routes/index.ts line 101 — ROLE_ENUM includes CUSTOMER_SERVICE. Login route (line 57-69) only checks active flag and password hash. No role gating on login itself.
  timestamp: 2026-03-18

- hypothesis: auth-portal landing page DASHBOARD_MAP missing CUSTOMER_SERVICE
  evidence: apps/auth-portal/app/landing/page.tsx line 68 — CUSTOMER_SERVICE is present in DASHBOARD_MAP with correct label, url (CS_DASHBOARD_URL), and Icon.
  timestamp: 2026-03-18

- hypothesis: Login route in auth-portal/app/api/login/route.ts strips CUSTOMER_SERVICE from effectiveRoles
  evidence: route.ts line 40-42 — stripping only applies to SUPER_ADMIN; non-SUPER_ADMIN roles are passed through as-is. CUSTOMER_SERVICE passes through correctly.
  timestamp: 2026-03-18

- hypothesis: "td is not defined" is an HTML <td> element issue
  evidence: All <td> occurrences in owner-dashboard/app/page.tsx are JSX elements, not variable references. The error is a JavaScript variable TD (uppercase) referenced at line 309.
  timestamp: 2026-03-18

## Evidence

- timestamp: 2026-03-18
  checked: apps/auth-portal/.env.example
  found: CS_DASHBOARD_URL is NOT listed in the env.example file. Only OWNER_DASHBOARD_URL, MANAGER_DASHBOARD_URL, and PAYROLL_DASHBOARD_URL are defined.
  implication: CS_DASHBOARD_URL is undefined in the auth-portal environment. DASHBOARD_MAP[CUSTOMER_SERVICE].url resolves to empty string "". The landing page .filter(r => DASHBOARD_MAP[r]) passes (the config object exists), but goTo("") navigates to an empty URL. More critically: if CS_DASHBOARD_URL is not set, the card may appear but clicking it fails silently or opens a broken URL.

- timestamp: 2026-03-18
  checked: apps/owner-dashboard/app/page.tsx lines 89-113 (style constants block) and global search for "const TD"
  found: The constant TD is never defined anywhere in owner-dashboard/app/page.tsx. The block defines CARD, LBL, SECTION_TITLE, SECTION_SUBTITLE — no TD.
  implication: Line 309 `...TD` in the edit-mode <td> style spread causes a ReferenceError at runtime the moment any UserRow enters edit mode.

- timestamp: 2026-03-18
  checked: apps/owner-dashboard/app/page.tsx line 67 — ROLES constant
  found: ROLES = ["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN"]. CUSTOMER_SERVICE is absent.
  implication: RoleCheckboxes component (line 128) iterates over ROLES. A CUSTOMER_SERVICE user loaded from the API will have "CUSTOMER_SERVICE" in their roles array — it shows correctly via Badge (ROLE_COLORS has no entry so it falls back to colors.textTertiary), but editing that user cannot assign/unassign the CUSTOMER_SERVICE role because it has no checkbox. Also ROLE_COLORS has no CUSTOMER_SERVICE entry, so it would render with a fallback color.

- timestamp: 2026-03-18
  checked: apps/owner-dashboard/app/page.tsx line 309
  found: `style={{ ...TD, background: colors.bgSurfaceRaised, padding: 20, borderLeft: ... }}` — TD is used but undefined.
  implication: This is the direct cause of the "TD is not defined" ReferenceError. Every time the edit form opens (setEdit(true)), the component re-renders and evaluates ...TD, which throws.

## Resolution

root_cause: |
  TWO independent bugs:

  BUG 1 — Login/redirect failure for CUSTOMER_SERVICE users:
    The auth-portal's .env.example (and likely .env) is missing CS_DASHBOARD_URL. In
    apps/auth-portal/app/landing/page.tsx, DASHBOARD_MAP["CUSTOMER_SERVICE"].url is
    `process.env.CS_DASHBOARD_URL || ""`. When the env var is not set, url is "". The
    dashboard card still renders (the config object exists so filter passes), but clicking
    it opens an empty URL — effectively a broken navigation. If the CS dashboard is not
    running or the URL is not configured, the CUSTOMER_SERVICE user appears to "fail login"
    because they see no working destination.

  BUG 2 — "TD is not defined" ReferenceError when editing a user:
    In apps/owner-dashboard/app/page.tsx, the UserRow edit form (line 309) spreads a
    style constant named `TD` that was never defined. The style constants block defines
    CARD, LBL, SECTION_TITLE, SECTION_SUBTITLE — TD is completely absent. This is a
    straight ReferenceError that fires every time any user row enters edit mode.
    Additionally, CUSTOMER_SERVICE is absent from the ROLES array (line 67) used by
    RoleCheckboxes, so even after fixing TD, a CUSTOMER_SERVICE user's role cannot be
    assigned or unassigned via the edit form.

fix: |
  Fix 1 — apps/auth-portal/.env.example (and actual .env):
    Add: CS_DASHBOARD_URL=http://localhost:3027   (or whatever port cs-dashboard runs on)

  Fix 2 — apps/owner-dashboard/app/page.tsx:
    a) Add the missing TD constant in the style constants block (around line 89-113):
       const TD: React.CSSProperties = {
         ...baseTdStyle,
       };
       (or use baseTdStyle directly at line 309 instead of TD)

    b) Add CUSTOMER_SERVICE to the ROLES array (line 67):
       const ROLES = ["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN", "CUSTOMER_SERVICE"] as const;

    c) Add CUSTOMER_SERVICE to ROLE_COLORS (line 77):
       CUSTOMER_SERVICE: "#f59e0b",   // matches the amber color used in landing page DASHBOARD_MAP

verification: Not yet applied — diagnosis mode only.
files_changed: []
