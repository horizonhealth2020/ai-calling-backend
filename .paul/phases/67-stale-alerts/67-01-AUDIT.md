# Enterprise Plan Audit Report

**Plan:** .paul/phases/67-stale-alerts/67-01-PLAN.md
**Audited:** 2026-04-13
**Verdict:** Enterprise-ready (after upgrades applied)

---

## 1. Executive Verdict

Conditionally acceptable pre-audit; **enterprise-ready after 1 must-have + 3 strongly-recommended upgrades applied**.

The plan correctly separates staleness rules for chargebacks (worked = reset) vs pending terms (resolution only). The server-side computation avoids timezone drift. The main risks were: ambiguous timezone for "midnight", N+1 query pattern for chargeback staleness, fragile name matching, and unnecessary extra API calls from My Queue.

## 2. What Is Solid

- **Dual staleness model**: Different rules for chargebacks (attempt resets clock) and pending terms (resolution only) correctly model the business requirement. This is not overengineered — it's two simple date comparisons with different reference points.
- **Server-side computation**: Staleness computed on the API, not the client. Eliminates timezone drift, clock skew, and manipulation.
- **Computed, not stored**: No schema changes needed — staleness is a function of existing timestamps. No stale migration, no stale flag to keep in sync.
- **Role-appropriate views**: CS reps see their own queue; owners see the aggregate. Clean separation.
- **Boundary discipline**: No schema changes, no notification system, no round-robin changes. Tight scope.

## 3. Enterprise Gaps Identified

### Gap 1: "Midnight of createdAt" — Which Timezone? (CRITICAL)
The plan says "midnight of createdAt" but doesn't specify timezone. Postgres stores timestamps in UTC. If "midnight" means UTC midnight, the deadline is unambiguous. If it means local midnight (America/New_York per PROJECT.md Luxon usage), the computation needs timezone conversion. Wrong timezone = records become stale at the wrong time.

### Gap 2: N+1 Query for Chargeback Staleness
The plan describes "for each, check if stale" with per-chargeback ContactAttempt lookups. With 50-200 open chargebacks, this is 50-200 individual queries. Needs a batch query with LEFT JOIN + MAX aggregation.

### Gap 3: Name Matching Fragility
Case-insensitive comparison is good, but `assignedTo` could have trailing spaces from round-robin assignment or paste parsing. `.trim()` on both sides prevents "Alex " != "Alex" mismatches.

### Gap 4: My Queue Double-Fetch
The plan's My Queue section says "fetch all records assigned to this user: GET /api/chargebacks + GET /api/pending-terms filtered client-side." This means 3 API calls (stale-summary + chargebacks + pending-terms) when 1 would suffice. The stale-summary endpoint should return ALL assigned records, not just stale ones.

### Gap 5: Stale Overview Polling
The stale overview is a snapshot at page load. Records becoming stale during a session won't surface until refresh. Acceptable for now since CS page reloads on tab switch.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Timezone ambiguity for "midnight" | Task 1 action: staleness calculation | Specified UTC midnight explicitly. Project uses UTC for storage; local display handled by Luxon on frontend. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | N+1 query for chargeback staleness | Task 1 action: query pattern | Replaced per-record loop with LEFT JOIN + MAX(created_at) batch query pattern |
| 2 | Name matching whitespace | Task 1 action: assignedTo filter | Added `.toLowerCase().trim()` on both sides |
| 3 | My Queue double-fetch | Task 1 action + Task 2 action | Added `allRecords` field to stale-summary response; My Queue uses single endpoint |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Stale overview real-time updates | CS page reloads on tab switch; stale items don't need sub-minute freshness. Phase 68 analytics may add auto-refresh. |

## 5. Audit & Compliance Readiness

**Audit trail**: Staleness is computed from immutable timestamps (createdAt, ContactAttempt.createdAt, resolvedAt). No stored state to become inconsistent. An auditor can independently verify any record's staleness using the same date math.

**Silent failure prevention**: The batch query approach means a failed query is a single visible error, not a partial-success where some records show stale and others silently fail.

**Accountability**: The owner stale overview creates organizational visibility into CS response times. Combined with the Phase 66 bypassReason on records, there's a complete chain: who was assigned → when they worked it → whether they bypassed the gate → why.

## 6. Final Release Bar

**What must be true before ship:**
- UTC midnight used consistently in staleness computation
- Batch query for chargeback staleness (no N+1)
- Name matching is trim + case-insensitive

**Remaining risks if shipped:**
- Name mismatch between assignedTo and user.name would make records invisible in My Queue (acceptable — same risk exists for all assignedTo-based features)

**Sign-off:** After applied upgrades, this plan is enterprise-ready. The staleness computation is deterministic, auditable, and efficient.

---

**Summary:** Applied 1 must-have + 3 strongly-recommended upgrades. Deferred 1 item.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
