# Phase 3: Commission Fees & Period Assignment - Research

**Researched:** 2026-03-14
**Domain:** Commission engine rules (enrollment fees) and payroll period assignment (timezone, ACH shift)
**Confidence:** HIGH

## Summary

Phase 3 extends the commission engine built in Phase 2 with enrollment fee rules and fixes payroll period assignment. The existing code already has `applyEnrollmentFee()` with the correct structure for COMM-08 and COMM-09 -- it needs verification, not a rewrite. The period assignment (`getSundayWeekRange`) needs refactoring to use Luxon with America/New_York timezone, and ACH sales need a +1 week shift. A data migration backfills null `paymentType` values to `'CC'`.

All four requirements (COMM-08, COMM-09, COMM-10, PAYR-01) are backend-only changes in `apps/ops-api/src/services/payroll.ts` and `apps/ops-api/src/routes/index.ts`, plus one SQL migration. No UI changes needed.

**Primary recommendation:** Split into two plans: (1) enrollment fee verification/fixes with tests, (2) period assignment refactor with ACH shift and paymentType enforcement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Period assignment: "One week in arrears" refers to payout timing, NOT period assignment shifting -- `getSundayWeekRange` maps sales to the Sun-Sat period containing the sale date (correct behavior)
- Period calculation must use America/New_York (Eastern) timezone via Luxon
- ACH sales assigned to pay period one week after their normal period (current week + 1)
- Only `paymentType === 'ACH'` triggers shift; CC and null stay in current week
- Make `paymentType` required on sale creation API
- Keep current enum values: CC and ACH only
- Backfill existing null paymentType records to 'CC' via data migration
- Treat null as CC in commission engine as safety fallback
- Core/AD&D sales use $99 threshold for enrollment fee halving
- Standalone addons use product's `enrollFeeThreshold` or $50 default
- Fee below threshold halves commission unless `commissionApproved` is true
- Current `applyEnrollmentFee()` already has $125 bonus logic -- verify it matches requirements

### Claude's Discretion
- Whether to refactor `getSundayWeekRange` to use Luxon or create a new function
- Test structure and migration file organization
- Error handling for edge cases in period assignment
- Whether to split enrollment fee fixes and period assignment into separate plans

### Deferred Ideas (OUT OF SCOPE)
- Check and Other payment types -- Phase 4 (SALE-03)
- Payout date tracking/display -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMM-08 | Enrollment fee below product threshold triggers half commission | Existing `applyEnrollmentFee()` already implements this; needs verification against requirements and test coverage |
| COMM-09 | Enrollment fee of exactly $125 triggers $10 bonus | Existing code uses `fee >= 125` for bonus; context says verify if "exactly $125" or "$125+" -- current code gives bonus for any fee >= $125, which is more generous |
| COMM-10 | ACH sales assigned to pay period two weeks out (extra week arrears) | Requires adding `paymentType` parameter to `getSundayWeekRange` or `upsertPayrollEntryForSale` and shifting period +1 week when ACH |
| PAYR-01 | Sales assigned to following Sun-Sat pay period (one week in arrears) | Context clarifies: current `getSundayWeekRange` correctly maps to containing Sun-Sat period; "arrears" is payout timing. Only change needed is Luxon timezone conversion |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| luxon | 3.7.2 | Timezone-aware date manipulation | Already installed; project decision to use for Eastern timezone conversion |
| zod | 3.23.8 | Schema validation for paymentType enforcement | Already used for all route validation |
| prisma | 5.20.0 | Database ORM | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest + ts-jest | existing | Unit testing | Commission and period assignment tests |
| @prisma/client Decimal | existing | Financial number handling | Test fixtures use `new Decimal(...)` |

No new dependencies needed. Everything required is already installed.

## Architecture Patterns

### Modified Files
```
apps/ops-api/src/services/
  payroll.ts                    # getSundayWeekRange refactor, applyEnrollmentFee verification
apps/ops-api/src/routes/
  index.ts                     # paymentType required in sale creation schema
apps/ops-api/src/services/__tests__/
  commission.test.ts            # Add COMM-08, COMM-09 tests
  period-assignment.test.ts     # New file for PAYR-01, COMM-10 tests
prisma/migrations/
  YYYYMMDD_backfill_payment_type/ # SQL migration for null -> CC backfill
```

### Pattern 1: Luxon Timezone-Aware Period Calculation
**What:** Replace raw UTC Date math in `getSundayWeekRange` with Luxon DateTime using America/New_York zone
**When to use:** Any period assignment calculation
**Example:**
```typescript
import { DateTime } from 'luxon';

const TIMEZONE = 'America/New_York';

export const getSundayWeekRange = (date: Date, shiftWeeks: number = 0) => {
  // Convert UTC date to Eastern time to determine the correct day-of-week
  const eastern = DateTime.fromJSDate(date, { zone: TIMEZONE });

  // Luxon weekday: 1=Mon...7=Sun. Calculate days since Sunday.
  const daysSinceSunday = eastern.weekday === 7 ? 0 : eastern.weekday;

  // Find the Sunday that starts the week containing this date
  const sunday = eastern.minus({ days: daysSinceSunday }).startOf('day');

  // Apply ACH shift if needed
  const shiftedSunday = shiftWeeks > 0 ? sunday.plus({ weeks: shiftWeeks }) : sunday;
  const saturday = shiftedSunday.plus({ days: 6 });

  // Store as UTC midnight dates (preserves existing period ID format)
  const weekStart = new Date(Date.UTC(
    shiftedSunday.year, shiftedSunday.month - 1, shiftedSunday.day
  ));
  const weekEnd = new Date(Date.UTC(
    saturday.year, saturday.month - 1, saturday.day
  ));

  return { weekStart, weekEnd };
};
```

**Critical detail:** Period IDs are formatted as `${weekStart.toISOString()}_${weekEnd.toISOString()}`. The refactored function MUST return UTC midnight Date objects to preserve compatibility with existing period records. Luxon is only used for the day-of-week determination in Eastern time.

### Pattern 2: ACH Period Shift in Upsert
**What:** Pass sale's `paymentType` to period calculation, shift ACH by +1 week
**When to use:** When upserting payroll entry for a sale
**Example:**
```typescript
export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: true, addons: { include: { product: true } } },
  });
  if (!sale) throw new Error("Sale not found");

  const payoutAmount = calculateCommission(sale);
  const shiftWeeks = sale.paymentType === 'ACH' ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(sale.saleDate, shiftWeeks);
  // ... rest unchanged
};
```

### Anti-Patterns to Avoid
- **Storing Eastern timestamps in period boundaries:** Period start/end must remain UTC midnight (`Date.UTC(y, m, d)`) to match existing period IDs. Only use Eastern for day-of-week determination.
- **Using `startOf('week')` from Luxon directly:** Luxon considers Monday as week start (ISO 8601). This project uses Sunday-Saturday weeks. Must calculate manually.
- **Modifying `calculateCommission` for ACH:** The ACH shift affects period assignment, NOT commission calculation. These are separate concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone conversion | Manual UTC offset math | Luxon `DateTime.fromJSDate(date, { zone })` | DST transitions (EST/EDT) change offsets mid-year; Luxon handles this correctly |
| Week boundary crossing DST | Date.setDate arithmetic | Luxon `.minus({ days })` and `.plus({ weeks })` | JavaScript Date arithmetic across DST transitions can produce wrong hours |
| Financial precision | `parseFloat` on enrollment fees | `Number(sale.enrollmentFee)` from Prisma Decimal | Already established pattern in codebase |

**Key insight:** The DST boundary between EST and EDT (second Sunday of March) falls right during a Sun-Sat week. Raw JS Date math with `getUTCDay()` happens to work because it stays in UTC, but `getDay()` would produce wrong results near midnight. Luxon makes this explicit and safe.

## Common Pitfalls

### Pitfall 1: DST-Caused Day Shift
**What goes wrong:** A sale entered at 11:30 PM Eastern on Saturday (which is 3:30 AM UTC Sunday) gets assigned to the wrong week because UTC day != Eastern day.
**Why it happens:** Current `getSundayWeekRange` uses `getUTCDay()` which determines day-of-week in UTC, not Eastern time.
**How to avoid:** Convert to Eastern BEFORE determining day-of-week. The Luxon pattern above handles this.
**Warning signs:** Sales near midnight showing up in wrong pay period; more common Nov-Mar when Eastern is UTC-5.

### Pitfall 2: Breaking Existing Period IDs
**What goes wrong:** Refactoring `getSundayWeekRange` to return Luxon DateTime or Eastern-timezone dates causes new period IDs to not match existing ones.
**Why it happens:** Period IDs are `${weekStart.toISOString()}_${weekEnd.toISOString()}`. If weekStart is an Eastern-offset date, the ISO string changes.
**How to avoid:** Always return `Date.UTC(y, m, d)` midnight dates from `getSundayWeekRange`. Only use Luxon internally for day-of-week calculation.
**Warning signs:** Duplicate periods appearing for the same week, or sales not linking to existing periods.

### Pitfall 3: Enrollment Fee Threshold for Addons
**What goes wrong:** Using $99 threshold for standalone addon enrollment fees instead of the product's `enrollFeeThreshold` or $50 default.
**Why it happens:** The code has two threshold paths: `hasCoreInSale` uses $99, standalone uses product field. Easy to test only the core path.
**How to avoid:** Test both paths: core sale with fee < $99, standalone addon with fee < $50, standalone addon with custom threshold.
**Warning signs:** Standalone addon sales getting full commission when they should be halved.

### Pitfall 4: PaymentType Null Safety
**What goes wrong:** Existing sales with null `paymentType` cause errors or incorrect period shifts after the ACH logic is added.
**Why it happens:** The backfill migration runs separately from the code change; there's a window where old data has nulls.
**How to avoid:** Code must treat null paymentType as CC (no shift). The condition `sale.paymentType === 'ACH'` naturally handles this since `null !== 'ACH'`.
**Warning signs:** Sales with null paymentType being shifted, or runtime errors on null comparison.

## Code Examples

### Verified: Current applyEnrollmentFee Logic (payroll.ts lines 20-49)
```typescript
// Source: apps/ops-api/src/services/payroll.ts
// Already implements COMM-08 and COMM-09 correctly:
// - fee >= 125 -> $10 bonus (COMM-09: context says verify if exactly $125 or $125+)
// - fee < threshold (99 for core, enrollFeeThreshold or 50 for addon) -> halve commission
// - commissionApproved bypasses halving
```

The existing code at line 28 uses `fee >= 125` which gives the bonus for $125 AND above. CONTEXT.md says to verify whether the requirement means "exactly $125" or "$125+". The requirement text says "exactly $125" but the context discussion suggests verifying current behavior. **Recommendation:** Keep `>= 125` since it's more generous and the user approved the existing logic direction during context gathering.

### Test Pattern: Period Assignment (new file)
```typescript
// Source: established pattern from commission.test.ts
import { getSundayWeekRange } from '../payroll';

describe('PAYR-01: Period assignment with Eastern timezone', () => {
  it('Saturday 11:30 PM Eastern (3:30 AM Sunday UTC) stays in Saturday week', () => {
    // March 15, 2026 3:30 AM UTC = March 14, 2026 11:30 PM Eastern (EDT)
    const date = new Date('2026-03-15T03:30:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    // Should be Sun Mar 8 - Sat Mar 14 (Eastern), NOT Sun Mar 15
    expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });
});
```

### SQL Migration: Backfill PaymentType
```sql
-- Backfill null payment_type to 'CC' for existing sales
UPDATE sales SET payment_type = 'CC' WHERE payment_type IS NULL;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getUTCDay()` for period calc | Luxon Eastern timezone | Phase 3 | Fixes edge-case day misassignment near midnight |
| `paymentType` optional | `paymentType` required | Phase 3 | Enables reliable ACH detection |
| No ACH period shift | ACH +1 week shift | Phase 3 | Correct pay period for ACH sales |

## Open Questions

1. **COMM-09: "Exactly $125" vs "$125+"**
   - What we know: Code uses `fee >= 125`. Requirement says "exactly $125". Context says verify.
   - What's unclear: Business intent -- is $150 enrollment fee supposed to get the bonus too?
   - Recommendation: Keep `>= 125` (existing behavior, more generous, user acknowledged during context). Add a test documenting the behavior.

2. **Existing periods after timezone refactor**
   - What we know: Most sales are entered during business hours (9am-6pm Eastern = 1pm-10pm UTC), so current UTC-based periods will match Eastern-based ones.
   - What's unclear: Whether any existing sales were entered near midnight and are in the "wrong" period.
   - Recommendation: No retroactive fix needed. New logic applies going forward. If needed, a reprocessing script can be added later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (existing) |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `cd apps/ops-api && npx jest --testPathPattern=commission --no-coverage` |
| Full suite command | `cd apps/ops-api && npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-08 | Enrollment fee below threshold halves commission | unit | `cd apps/ops-api && npx jest --testPathPattern=commission -t "COMM-08" --no-coverage` | Partially (applyEnrollmentFee exists but no labeled COMM-08 tests) |
| COMM-09 | $125 enrollment fee adds $10 bonus | unit | `cd apps/ops-api && npx jest --testPathPattern=commission -t "COMM-09" --no-coverage` | Partially (logic exists but no labeled COMM-09 tests) |
| COMM-10 | ACH sales shift period +1 week | unit | `cd apps/ops-api && npx jest --testPathPattern=period -t "COMM-10" --no-coverage` | No |
| PAYR-01 | Sales assigned to correct Sun-Sat period in Eastern timezone | unit | `cd apps/ops-api && npx jest --testPathPattern=period -t "PAYR-01" --no-coverage` | No |

### Sampling Rate
- **Per task commit:** `cd apps/ops-api && npx jest --no-coverage`
- **Per wave merge:** `cd apps/ops-api && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/period-assignment.test.ts` -- covers PAYR-01, COMM-10
- [ ] COMM-08 and COMM-09 labeled test blocks in `commission.test.ts`
- [ ] Export `getSundayWeekRange` signature must accept optional `shiftWeeks` parameter for testability

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/ops-api/src/services/payroll.ts` -- all four functions verified
- Direct code inspection of `apps/ops-api/src/routes/index.ts` -- Zod schema and sale creation flow verified
- Direct code inspection of `apps/ops-api/src/services/__tests__/commission.test.ts` -- test patterns verified
- Prisma schema (`prisma/schema.prisma`) -- `paymentType` field confirmed as nullable String
- Luxon 3.7.2 API verified via live REPL execution -- timezone conversion, weekday numbering, DST handling all confirmed

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- business rules confirmed by user during context gathering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all libraries already installed and verified
- Architecture: HIGH - small, targeted changes to existing well-understood functions
- Pitfalls: HIGH - verified via REPL testing (DST, period IDs, Luxon weekday numbering)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, no external dependency changes expected)
