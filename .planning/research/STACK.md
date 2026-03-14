# Stack Research

**Project:** Ops Platform — Payroll & Usability Overhaul
**Dimension:** Stack
**Confidence:** HIGH

## Recommendation: Keep Existing Stack

No new packages needed. The existing stack covers every requirement.

## Current Stack Assessment

| Layer | Technology | Version | Sufficient? |
|-------|-----------|---------|-------------|
| API | Express | 4.19.2 | Yes |
| ORM | Prisma | 5.20.0 | Yes |
| DB | PostgreSQL | 15+ | Yes |
| Frontend | Next.js | 15.3.9 | Yes |
| UI | React | 18.3.1 | Yes |
| Real-time | Socket.IO | 4.8.3 | Yes |
| Validation | Zod | 3.23.8 | Yes |
| Date/Time | Luxon | 3.4.4 | Yes (installed but underused) |
| Charts | Recharts | 3.8.0 | Yes |
| Icons | Lucide React | 0.577.0 | Yes |

## Per-Requirement Stack Mapping

### Commission Calculations
- **Use:** Prisma Decimal at DB layer + plain JS Number arithmetic for percentage math
- **Why not decimal.js/dinero.js:** Commission rates are percentages (10%, 15%) applied to dollar amounts. Sub-cent precision is not required — rounding to 2 decimal places at calculation time is sufficient. Adding a decimal library adds dependency overhead for no business value.
- **Pattern:** Pure functions (`calculateCommission`, `calcProductCommission`) already exist in `payroll.ts`. Keep them pure, add test coverage.
- **Confidence:** HIGH

### Multi-Product Form State
- **Use:** `useReducer` with typed actions (ADD_PRODUCT, REMOVE_PRODUCT, SET_PRIMARY, TOGGLE_BUNDLE)
- **Why not React Hook Form/Formik:** Existing codebase uses zero form libraries — all forms use raw `useState`. `useReducer` matches this pattern while handling complex domain state (bundling rules, conditional commission preview).
- **Pattern:** Reducer manages product list, bundling state, payment type. Effects compute commission preview.
- **Confidence:** HIGH

### Scrollable Card Layouts
- **Use:** CSS `overflow-y: auto` with `maxHeight` on card containers via inline CSSProperties
- **Why not react-window/virtualization:** Max ~500 payroll cards per period. Virtual scrolling adds complexity for a dataset that renders in <50ms.
- **Confidence:** HIGH

### Real-Time Sale Cascade
- **Use:** Extend existing Socket.IO 4.8.3 with room-based broadcasting
- **Pattern:** API emits `sale:created`, `payroll:updated`, `leaderboard:refresh` after mutations. Dashboards subscribe to relevant rooms, re-fetch on event receipt.
- **Why not SSE/polling:** Socket.IO already installed, configured, and working for audit events. Just extend.
- **Confidence:** HIGH

### Reporting & Export
- **Use:** Server-side CSV generation (string concatenation or `papaparse` ~7KB)
- **Why server-side:** Payroll exports should come from authoritative server data, not client state
- **Optional addition:** `papaparse` only if CSV parsing (import) is also needed
- **Confidence:** MEDIUM

### Date/Period Logic
- **Use:** Luxon (already installed as `luxon 3.4.4`) for week boundary calculations
- **Current state:** `getSundayWeekRange` uses raw `Date` arithmetic — works but fragile around DST/month boundaries
- **Recommendation:** Optional refactor to Luxon for clarity. Not a blocker.
- **Confidence:** MEDIUM

## What NOT to Add

| Library | Why Not |
|---------|---------|
| decimal.js / dinero.js | Percentage-based commission math doesn't need arbitrary precision |
| React Hook Form / Formik | Codebase convention is raw state management |
| react-window / react-virtualized | Dataset too small to justify |
| Redux / Zustand | Per-page state with Socket.IO refresh is sufficient |
| TanStack Query | Simple authFetch + useState pattern works for this app scale |
| Tailwind CSS | Project uses inline CSSProperties — hard constraint |

## Open Questions

- **Export format:** CSV or Excel? CSV recommended (universal payroll import). If Excel required, add `exceljs` server-side only.
- **Luxon migration:** Optional cleanup of raw Date arithmetic. Recommended for clarity but not blocking.

---
*Research completed: 2026-03-14*
