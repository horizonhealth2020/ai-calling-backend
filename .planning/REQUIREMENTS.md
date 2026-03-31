# Requirements: Ops Platform

**Defined:** 2026-03-31
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v2.0 Requirements

Requirements for Sales Board TV Readability milestone. Each maps to roadmap phases.

### Typography

- [ ] **TYPO-01**: All data elements on weekly breakdown table have font sizes increased for TV-distance readability (agent names, daily counts, daily premiums, total column, premium column)
- [ ] **TYPO-02**: All data elements on daily/podium leaderboard view have font sizes increased for TV-distance readability
- [ ] **TYPO-03**: Team total row font sizes increased proportionally to match data row increases
- [ ] **TYPO-04**: KPI stat cards at top have font sizes increased for TV distance
- [ ] **TYPO-05**: Secondary text colors (textTertiary, textMuted) promoted one contrast tier for TV visibility in lit offices

### Scaling

- [ ] **SCAL-01**: Font sizes dynamically scale based on agent count — larger when fewer agents, smaller when more agents
- [ ] **SCAL-02**: 15 agents fit on a 1080p TV without scrolling on weekly breakdown view
- [ ] **SCAL-03**: 15 agents fit on a 1080p TV without scrolling on daily/podium view
- [ ] **SCAL-04**: Row padding adjusts to compensate for larger fonts — cell dimensions stay visually consistent

### Overflow

- [ ] **OVFL-01**: Long agent names (e.g., "Christopher Rodriguez") don't cause horizontal scrolling at increased font sizes
- [ ] **OVFL-02**: Large premium values (e.g., $12,345) don't overflow cells at increased font sizes

## Future Requirements

None deferred — milestone is tightly scoped.

## Out of Scope

| Feature | Reason |
|---------|--------|
| TV-only mode toggle (`?tv=1` param) | Single-purpose display — board is always on TV |
| Auto-rotating between views | Anti-feature for TV dashboards — causes disorientation |
| Scrolling/pagination for many agents | All agents must be visible simultaneously |
| AnimatedNumber duration tuning | Polish item — can be addressed post-milestone if needed |
| Desktop browser optimization | Board is viewed on TV; desktop is secondary |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TYPO-01 | TBD | Pending |
| TYPO-02 | TBD | Pending |
| TYPO-03 | TBD | Pending |
| TYPO-04 | TBD | Pending |
| TYPO-05 | TBD | Pending |
| SCAL-01 | TBD | Pending |
| SCAL-02 | TBD | Pending |
| SCAL-03 | TBD | Pending |
| SCAL-04 | TBD | Pending |
| OVFL-01 | TBD | Pending |
| OVFL-02 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after initial definition*
