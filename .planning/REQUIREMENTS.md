# Requirements: Ops Platform — Pre-Launch Stabilization

**Defined:** 2026-03-25
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.6 Requirements

Requirements for pre-launch stabilization. No new features — cleanup, audit, and hardening only.

### File Structure

- [ ] **FS-01**: Morgan voice service files relocated to `apps/morgan/` with no behavior change
- [ ] **FS-02**: Stale standalone `payroll-dashboard` app deleted from `apps/`
- [ ] **FS-03**: Orphaned root files (beyond Morgan) identified and removed or relocated
- [ ] **FS-04**: Stale docs (FIXES.md, ISSUES.md, TESTING.md, docs/) consolidated into README and deleted

### Dead Code Removal

- [ ] **DC-01**: Unused imports removed across all apps and packages
- [ ] **DC-02**: Unreferenced functions, components, and exports removed
- [ ] **DC-03**: Commented-out code blocks removed
- [ ] **DC-04**: Unused dependencies removed from package.json files

### Error Handling & Robustness

- [ ] **EH-01**: All async route handlers have proper error boundaries (no unhandled rejections)
- [ ] **EH-02**: API endpoints validate all required inputs with Zod (no raw `req.body` access)
- [ ] **EH-03**: Database queries handle connection/timeout errors gracefully
- [ ] **EH-04**: Socket.IO event handlers have try/catch wrappers

### Type Safety

- [ ] **TS-01**: No `any` types in application code (excluding third-party type gaps)
- [ ] **TS-02**: API response types match actual response shapes
- [ ] **TS-03**: Shared package exports have explicit type annotations

## Future Requirements

### Post-Launch

- **POST-01**: Bulk sale import from CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features or UI changes | Stabilization only — no new capabilities |
| Morgan voice service logic changes | Relocating only, no behavior modifications |
| Performance optimization | Not a current bottleneck; address post-launch if needed |
| Test coverage expansion | Existing tests preserved; new test writing deferred to post-launch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FS-01 | — | Pending |
| FS-02 | — | Pending |
| FS-03 | — | Pending |
| FS-04 | — | Pending |
| DC-01 | — | Pending |
| DC-02 | — | Pending |
| DC-03 | — | Pending |
| DC-04 | — | Pending |
| EH-01 | — | Pending |
| EH-02 | — | Pending |
| EH-03 | — | Pending |
| EH-04 | — | Pending |
| TS-01 | — | Pending |
| TS-02 | — | Pending |
| TS-03 | — | Pending |

**Coverage:**
- v1.6 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after initial definition*
