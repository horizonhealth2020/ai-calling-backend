# Phase 76 — CS Mobile — CONTEXT

**Phase:** 76 of 76 (v3.0 milestone final)
**Milestone:** v3.0 Mobile-Friendly Dashboards (closes milestone at 100%)
**Date:** 2026-04-15
**Prior phase:** 75 Owner Mobile ✓ (attribute-only retrofit, 4 files)

---

## Goals

1. **CS agent daily work is first-class on mobile.** Chargeback/pending-term tracking, My Queue, and outreach logging must be usable on a phone on the job floor and while on-call with a customer.
2. **Outreach logging is the high-value mobile moment.** Log Call / Log Email / Log Text buttons need comfortable tap targets; the attempt timeline (1/3, 2/3, 3/3) must read cleanly; the 3-call gate override CTA must remain visible and not be occluded by the soft keyboard.
3. **Resolution flow (SAVED / CANCELLED / NO_CONTACT) is one tap on mobile** — row→bottom-sheet treatment if tracking currently uses inline row-edit for resolution.
4. **CSAnalytics (owner/admin tab) gets same treatment as OwnerTrends** — ResponsiveContainer handles Recharts, leaderboard tables → cards via `.responsive-table + data-label`. Not the primary mobile consumption surface; card-layout-only, no mobile-specific sort controls.
5. **Close v3.0 milestone** — this is phase 5/5.

## Approach

- **Attribute-only retrofit where possible** (className + data-label on tables) — Phase 75's proven technique. Keeps diff small and makes CS resolution / outreach / bypass logic changes structurally impossible.
- **Structural edits only where required:**
  - Outreach logging workspace → stacked form on mobile; submit is **inline + safe-area padding, NEVER sticky** (iOS soft-keyboard rule from Phase 73 decision).
  - Row-edit → bottom-sheet if CSTracking uses inline row-edit for resolution. Audit precondition.
  - Mirror 3-call gate-override status inline above resolution CTA if it stacks below on mobile (ManagerEntry mini Commission Preview pattern from Phase 73).
- **Recharts untouched** — ResponsiveContainer + XAxis default handle narrow widths, confirmed in Phase 75.
- **Audit-driven upgrades from prior-phase lessons:**
  - Explicit cell-classification precondition (reading vs inline-edit vs action) before applying `.responsive-table` vs `.responsive-table-no-label`.
  - Exhaustive data-label coverage — no "rough draft" labels.
  - Structural argument that CS mutation logic is untouched: git diff shows zero modifications to resolve/outcome/gate-override call sites (grep plan: `resolveChargeback`, `setOutcome`, `bypassReason`, `ContactAttempt` mutations).
  - Pre-phase baseline capture (desktop screenshots of affected surfaces before edits).

## Scope

**In scope:**
- CSTracking — chargeback + pending-term tables → card treatment
- CSMyQueue — per-agent work queue (CS role only, not owner/admin per Phase 67 decision)
- CSAnalytics — owner-view tab: leaderboards, attempt-count correlation chart, bypass rollup, drill-downs
- Outreach logging workspace (Phase 66 UI): Log Call/Email/Text + notes + attempt timeline + gate-override + bypassReason capture
- Resolution modal / bottom-sheet for SAVED / CANCELLED / NO_CONTACT flow

**Out of scope (deferred — admin-only or desktop power-user surfaces):**
- CSV export UI — not a mobile consumption event (same defer as Phase 75 sort controls)
- Mobile-specific sort controls on CSAnalytics card mode — desktop power-user workflow
- Any CS admin/config surfaces if discovered during audit (mirrors OwnerConfig/OwnerUsers defer in Phase 75)

## Open Questions (resolve during `/paul:plan`)

1. **CSTracking resolution pattern:** Does it use inline row-edit, a modal, or separate screen? → dictates bottom-sheet vs stacked-modal treatment and whether `.responsive-table-no-label` is needed for the action cell.
2. **File count estimate:** CSTracking, CSMyQueue, CSAnalytics, outreach logging workspace = ~4 files. Any supporting drill-down components?
3. **Any CS admin/config surfaces** discovered during audit that should be deferred as not mobile-consumption?
4. **Debounced search input on mobile:** currently debounced for desktop (Phase 51); verify it still works cleanly with on-screen keyboard on phone.

## Inherited Patterns (from Phases 72–75 — use, don't reinvent)

- `.responsive-table` + `data-label="..."` for table→card transform
- `.responsive-table-no-label` escape valve for action cells / colspan rows
- `.stack-mobile` / `.stack-mobile-md` for form stacking — **scope to parent only** (no icon-above-title bugs on pure-title SECTION_HEADER divs)
- `.touch-target` for 44px tap zones
- Submit buttons on mobile: INLINE + `paddingBottom: max(env(safe-area-inset-bottom), 16px)` — NEVER sticky/fixed (iOS keyboard occlusion)
- Wide unstackable grids: horizontal scroll + textual hint `← swipe to see all X →`
- Sidebar → `MobileDrawer`: conditional mount-gate (not CSS hide) to avoid double-mount
- Recharts: `ResponsiveContainer` handles width; don't touch component props
- Mirror key info inline above primary CTA when sidebar stacks below on mobile

## Success Criteria Preview (for plan-phase)

- CS agent can work a chargeback end-to-end on phone: see it in My Queue → open → log attempt with notes → resolve as SAVED/CANCELLED/NO_CONTACT without horizontal scroll, without keyboard-occluded submit, without offscreen gate-override.
- CSAnalytics readable on phone for owner spot-checking: leaderboards as cards, correlation chart auto-width.
- Zero modifications to CS mutation logic (resolve/outcome/gate/bypass call sites).
- v3.0 milestone closed.

---

*Created: 2026-04-15*
*Next step: `/paul:plan` to create 76-01-PLAN.md from this context*
