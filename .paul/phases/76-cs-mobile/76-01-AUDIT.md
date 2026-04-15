# Enterprise Plan Audit Report

**Plan:** .paul/phases/76-cs-mobile/76-01-PLAN.md
**Audited:** 2026-04-15
**Verdict:** conditionally acceptable → enterprise-ready AFTER applied upgrades

---

## 1. Executive Verdict

Plan was well-grounded (followed Phase 75's playbook, surfaced CSTracking's inline-expanded-row pattern correctly, scope match to roadmap), but contained **three classes of defect** that would have produced rework during APPLY:

1. **Factually wrong assumption in Task 1:** the outermost expanded-workspace `<div>` at CSTracking:1054 is ALREADY `display: flex, flexDirection: column`. Plan step 9 instructed "add `stack-mobile-md`" to a container that is already stacked. Real mobile work needed on three INNER flex rows (Log Attempt pills, Resolution Type pills, Save/Discard footer) — plan missed all three.
2. **Over-claiming in AC-1:** the gate-override block (CSTracking:1125) ALREADY renders above the Save Resolution button (CSTracking:1146). Plan framed this as an "elevation lift" — it's a verify-and-assert. Misframing changes risk profile (a lift is higher-risk than a verify).
3. **Non-deterministic decision tree in Task 3 step 6:** had options (a)–(e) with fallback logic ("if no utility exists… prefer option (a)… check whichever approach is in use…"). Phase 73 and 74 audits both rejected this anti-pattern — plans must be deterministic.

All three corrected by auto-applied upgrades. Plan is now sound.

I would sign my name on the revised plan for production delivery.

## 2. What Is Solid

- **Attribute-only retrofit pattern** — inherits Phase 73/75's proven technique. Makes CS mutation logic modifications structurally impossible.
- **AC-4 structural-guarantee approach** — using `git diff | grep` to prove zero modifications to resolveChargeback/ContactAttempt/bypassReason/Recharts is the correct accountability model.
- **Scope discipline** — correctly defers CSV export UI, mobile sort controls, drill-down interactions, and bottom-sheet (latter identified as unnecessary via grounded investigation of the inline expanded-row pattern).
- **Phase 75 coexistence lessons preserved** — stack-mobile scoping discipline, Recharts-untouched rule, pure-title SECTION_HEADER protection.
- **Baseline TS-error-count precondition (Task 1 step 1)** — inherits Phase 74/75 pattern correctly.
- **Exclusion of the sr-only accessibility table at CSAnalytics:1001** — correctly identified as untouchable a11y helper.

## 3. Enterprise Gaps Identified

### G1 (MUST-HAVE): Workspace stacking target wrong (Task 1 step 9)
CSTracking:1054 outer workspace div is already `flexDirection: "column"`. Plan directs `stack-mobile-md` there — a no-op. Meanwhile, three INNER flex rows genuinely need mobile treatment:
- Log Attempt type-picker (line 1059): 3 pills, overflow at 375px
- Resolution Type pill row (line 1109): 3 pills including "No Contact", overflow at 375px
- Save/Discard footer (line 1146): `flex justifyContent: flex-end`, overflows 2 buttons

Without this correction, mobile will render with clipped pills and cramped footer.

### G2 (MUST-HAVE): AC-1 over-claims gate-override "elevation"
AC-1 asserts "gate-override status block is visible ABOVE the resolution button on mobile (mirrors ManagerEntry mini-preview pattern)" — framing it as a new lift. In reality, lines 1125-1140 (gate block) render BEFORE lines 1146-1157 (Save footer) in the current JSX. This is verify-and-assert, not a lift. Misframing as a lift inflates risk and opens door to needless JSX reorganization.

### G3 (MUST-HAVE): Non-deterministic Task 3 step 6 decision tree
Options (a)–(e) with fallback logic. Phase 73/74 audits both explicitly rejected this pattern. Must pick one approach definitively (useIsMobile + mounted gate, per Phase 72 contract).

### G4 (MUST-HAVE): Keyboard a11y AC missing
Phase 73 audit added a keyboard a11y AC. This plan omitted it. CS is desk-work with physical keyboards — Tab order, focus-visible preservation, and click-to-sort retention at desktop breakpoint all need explicit ACs.

### G5 (MUST-HAVE): responsive.css import verification missing
If CS files don't transitively receive responsive.css, all className additions silently no-op. Verified manually during audit: ops-dashboard/app/layout.tsx imports it (OK). But the plan should PRECONDITION-check this so future runs on similar files don't skip it.

### G6 (MUST-HAVE): Lax data-label coverage instruction
Plan said "add data-label matching thead text" — too lax. Phase 73 audit required exhaustive enumeration. Phase 76 has 10 columns in chargeback table + 8 in pending-term + 3 tables in CSAnalytics — minimum 30 per-cell decisions. Enumeration prevents drift.

### G7 (STRONGLY-RECOMMENDED): AC-4 Recharts grep scope too narrow
Plan grepped for `dataKey=`, `margin=`, `stroke=`, `fill=`. Misses other Recharts props and doesn't protect against added/removed imports. Strengthened to guard all Recharts JSX tags (LineChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, etc.) and the recharts import line.

### G8 (STRONGLY-RECOMMENDED): Primary "Work" button misses touch-target
The "Work" button (CSTracking:990 chargeback, 1282 pending-term) is the PRIMARY mobile CTA entering the workspace. Current style is `padding: 0` — NOT 44px-tappable. Plan enumerated touch-target on other buttons but missed this one. Also missed: Save Attempt button, Discard button, Unresolve, Delete X, gate-override checkbox label.

### G9 (STRONGLY-RECOMMENDED): Baseline-triple missing
Phase 74 audit required pre-phase baseline capture (desktop-pre, mobile-pre, mobile-post, desktop-post). Phase 76 is 5 files + expanded workspace — visual regression risk higher than Phase 75.

### G10 (STRONGLY-RECOMMENDED): Handler-level DO NOT CHANGE boundaries
Plan's boundaries covered mutation BODIES and state reducers but not HANDLER functions (handleResolveCb, handleResolvePt, handleUnresolveCb, handleDeleteCb, handleLogAttempt, fetchAttempts, requestConfirm). A handler-level boundary provides a second ring of structural protection.

### G11 (CAN-SAFELY-DEFER): Escape-key binding for workspace dismissal
Adding an Escape-key listener to close the expanded workspace is a pure keyboard-UX improvement, but requires new event-handler code — scope-expanding. Dismissing via "Discard" button is already accessible. Defer to a future a11y-focused phase.

### G12 (CAN-SAFELY-DEFER): aria-live on attempt-count badge
"1/3 Calls" → "2/3 Calls" → "3/3 Calls" transitions are visually obvious but not announced by screen readers. `aria-live="polite"` would improve the experience. Not blocking — defer.

### G13 (CAN-SAFELY-DEFER): WCAG 2.1 AA contrast audit on card-mode labels
The `.responsive-table` data-label styling is inherited from Phase 72's responsive.css. Contrast audit was in-scope for Phase 72, not this plan.

### G14 (CAN-SAFELY-DEFER): Focus-trap or focus-redirect on Work-row expand
Moving focus into the workspace textarea when "Work" is clicked would improve keyboard UX. Requires new useEffect + ref. Scope-expanding; defer.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | G1: workspace stacking target wrong | Task 1 steps 10-16 | Replaced "add stack-mobile-md to outer workspace div" with scope-correct treatment of 3 internal flex rows (Log Attempt pills, Resolution Type pills, Save/Discard footer) + `flexWrap: wrap`. Added verify of "already column-stacked" outer div with documenting comment. |
| 2 | G2: AC-1 over-claims gate-override elevation | AC-1 + Task 1 new PRECONDITION step 4 | AC-1 reframed as VERIFY+ASSERT. Added PRECONDITION step 4 to confirm DOM order (gate-block before Save button) — if already-above: no change; if below: PAUSE. Task 1 step 14 says "no JSX reorder" with cited line references. |
| 3 | G3: Task 3 step 6 non-deterministic | Task 3 step 6 | Replaced options (a)–(e) with deterministic 5-step procedure using useIsMobile + mounted gate (Phase 72 contract). No branching. |
| 4 | G4: keyboard a11y AC missing | New AC-6 | Added AC-6 covering Tab focus order, focus-visible preservation, sort-header desktop preservation, and Enter-key handler integrity. Explicitly notes focus-trap is out of scope (deferred). |
| 5 | G5: responsive.css import verification | Task 1 PRECONDITION step 3 | Added grep precondition for `responsive.css` import in ops-dashboard/app/layout.tsx. PAUSE-if-missing gate. |
| 6 | G6: exhaustive data-label list | Task 1 steps 6-9 (chargeback) + steps 20-22 (pending-term) | Replaced lax "match thead" with exhaustive column-by-column line-referenced data-label assignments for both CSTracking tables (10 cols + 8 cols). Action cell explicitly marked `.responsive-table-no-label`. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 7 | G7: AC-4 Recharts grep too narrow | AC-4 | Added second `git diff` guard enumerating all Recharts component JSX tags + recharts import line + sr-only table byte-identity. |
| 8 | G8: missing touch-target enumerations | Task 1 steps 11, 12, 13, 15, 16, 17, 18, 19 | Explicitly added `touch-target` to "Work" button, Save Attempt, Log Attempt pills, Resolution Type pills, Save/Discard footer, Unresolve, Delete X, gate-override checkbox label. |
| 9 | G9: baseline-triple missing | Task 1 PRECONDITION step 5 | Added pre-phase baseline screenshot capture step (375px + 1280px × 5 surfaces) saved to `.paul/phases/76-cs-mobile/baselines/`. |
| 10 | G10: handler-level boundaries | boundaries section | Added handleResolveCb, handleResolvePt, handleUnresolveCb, handleUnresolvePt, handleDeleteCb, handleDeletePt, handleLogAttempt, fetchAttempts, requestConfirm to DO NOT CHANGE list. Added explicit protection for `expandedRowId` open-reset chain (6 setters in exact order). |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 11 | G11: Escape-key binding | Requires new event handler — scope-expanding. "Discard" button + outside-click already provide dismissal paths. Can be added in a dedicated a11y phase. |
| 12 | G12: aria-live on attempt-count | Screen-reader enhancement; not blocking for sighted CS agents. Revisit if CS team reports accessibility requests. |
| 13 | G13: WCAG AA contrast audit on card-mode labels | In-scope for Phase 72 (responsive.css owner), not this plan. If contrast fails, the fix lives in packages/ui/src/responsive.css. |
| 14 | G14: focus-trap/focus-redirect on Work-row | Requires ref + useEffect. UX improvement but non-blocking — keyboard users can still Tab into the workspace. Deferred to future a11y-focused phase. |

## 5. Audit & Compliance Readiness

**Defensible audit evidence:**
- AC-4 git-diff grep produces a diff-level artifact proving zero mutation-body changes. Reviewable in seconds.
- Exhaustive data-label list produces a countable coverage metric (`td count == data-label + responsive-table-no-label`). Mechanical verification.
- Baseline screenshots (Task 1 step 5) provide visual-regression evidence for auditors.

**Silent failure prevention:**
- responsive.css import PRECONDITION (step 3) prevents the "className additions silently no-op" class of silent failure.
- gate-override DOM-order PRECONDITION (step 4) prevents misframing drift if code structure changes between plan and apply.
- Keyboard a11y AC-6 prevents desktop keyboard-user regression from being invisible.

**Post-incident reconstruction:**
- Line-referenced data-label list means if a mobile bug is reported later, we can grep for the exact `data-label=` and know which `<td>` on which line was responsible.
- Handler-level DO NOT CHANGE list makes accidental handler-body edits auditable as boundary violations.

**Ownership and accountability:**
- Phase 76 owner: Juan (git user). Plan written 2026-04-15 by Claude Opus 4.6 (co-authored commits).
- v3.0 milestone final phase — closure ceremony (commit + ROADMAP final update + milestone mark complete) is explicit in success_criteria.

**Would fail a real audit if:**
- (before upgrades) Task 1 step 9's redundant stack-mobile-md would have produced a no-op diff with no mobile effect — auditors would flag as unverified claim.
- (before upgrades) AC-1's gate-override elevation claim was unfalsifiable as written; could not be proven or disproven without running the code.
- Both addressed by applied upgrades.

## 6. Final Release Bar

**Must be true before this plan ships:**
- All Task 1 PRECONDITION checks pass (TS baseline captured, JSX structure matches, responsive.css imported, gate-block-before-Save DOM order verified, baselines captured).
- `npx tsc --noEmit` from ops-dashboard stays at baseline count post-phase.
- `git diff main -- apps/ops-dashboard/app/(dashboard)/cs/` shows zero matches in mutation/handler/Recharts grep patterns (AC-4).
- DevTools 375px smoke passes all 5 ACs on all 5 CS surfaces.
- DevTools 1280px smoke shows pixel-parity with baselines.

**Risks if shipped as-is (WITH applied upgrades):**
- **Low:** line numbers in the exhaustive data-label list are based on current HEAD (e82d66d) — if CSTracking.tsx is modified on main between plan and apply, line numbers may drift. Mitigation: PRECONDITION step 2 reads the JSX structure and requires PAUSE on discrepancy.
- **Low:** iOS safe-area inset testing requires a real device or simulator; DevTools doesn't faithfully emulate env(safe-area-inset-bottom). Mitigation: inline + safe-area padding is the project standard (Phase 73 decision), structurally correct even if visual test is limited.
- **Low:** baseline screenshots are optional in Task 1 step 5 — if skipped, visual regression review is informal. Acceptable given inline-CSS retrofit has near-zero geometry drift risk.

**Would I sign my name on this?** Yes, with the applied upgrades. Plan is now enterprise-ready.

---

**Summary:** Applied 6 must-have + 4 strongly-recommended upgrades. Deferred 4 items.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
