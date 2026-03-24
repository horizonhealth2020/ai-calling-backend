---
status: testing
phase: 24-chargeback-automation-data-archival
source: [24-01-SUMMARY.md, 24-02-SUMMARY.md, 24-03-SUMMARY.md, 24-04-SUMMARY.md]
started: 2026-03-24T19:30:00.000Z
updated: 2026-03-24T19:30:00.000Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Run `npm run db:migrate` (or `npx prisma migrate deploy`) to apply the new migration. Then run `npm run ops:dev`. The server boots without errors, migration completes (creating chargeback matching fields + 3 archive tables), and hitting GET `http://localhost:8080/archive/stats` with a valid auth token returns a JSON response (even if all counts are 0).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Run `npm run db:migrate` to apply the new migration. Then run `npm run ops:dev`. Server boots without errors, migration creates matching fields + 3 archive tables, and GET `/archive/stats` returns JSON.
result: [pending]

### 2. Chargeback Auto-Matching on Submission
expected: Submit a chargeback via POST `/chargebacks` with a memberId that matches exactly one sale. The created chargeback should have `matchStatus: "MATCHED"` and `matchedSaleId` set to that sale's ID. Submit another with a memberId matching multiple sales — `matchStatus` should be `"MULTIPLE"`. Submit one with a memberId matching no sales — `matchStatus` should be `"UNMATCHED"`.
result: [pending]

### 3. GET /chargebacks Includes Match Data
expected: GET `/chargebacks` response now includes `matchStatus` and `matchedSale` (with id, memberName, agentId) for each chargeback record.
result: [pending]

### 4. Approve Alert Creates Correct Clawback
expected: Approve a chargeback alert (via the payroll dashboard) for a MATCHED chargeback. A clawback record is created with the correct `saleId` (from matchedSaleId, NOT the memberId string). The clawback amount should be the agent's commission from `PayrollEntry.payoutAmount`, not the full chargeback amount.
result: [pending]

### 5. Dedupe Guard Prevents Double Clawbacks
expected: Try approving the same chargeback alert a second time (or another alert pointing to the same chargeback/sale combo). The system should reject it with an error message about a clawback already existing for this combination.
result: [pending]

### 6. Unmatched Chargeback Cannot Be Approved
expected: Try approving a chargeback alert where the chargeback has `matchStatus: "UNMATCHED"` (no matched sale). The system should return an error: "Chargeback has no matched sale. Match manually before approving."
result: [pending]

### 7. Match Status Badges in CS Tracking Table
expected: Open the CS tracking page in the ops dashboard. The chargeback table has a new "Match" column. Matched chargebacks show a green "Matched" label, multi-match show amber "Review", unmatched show red "No Match", and null/legacy show a gray "--".
result: [pending]

### 8. Match Status in CSV Export
expected: Export chargebacks to CSV from the CS tracking page. The CSV includes a "Match Status" column with the matchStatus value for each row.
result: [pending]

### 9. Archive Preview Shows Eligible Counts
expected: As SUPER_ADMIN or OWNER_VIEW, hit GET `/archive/preview?cutoffDays=90`. Response returns `{ tables: [...], total: N }` showing how many records in each table (call_audits, convoso_call_logs, app_audit_log) are older than 90 days.
result: [pending]

### 10. Data Archive Section in Owner Config
expected: Open the Owner dashboard, go to the Config tab. A "Data Archive" section appears showing stats per archive table (row counts, date ranges). There's a number input for days (default 90) and an "Archive All Tables" button. Clicking the button fetches a preview count and shows inline confirmation: "This will archive {N} records older than {days} days." with Confirm/Cancel buttons (no modal, no type-to-confirm).
result: [pending]

### 11. Archive and Restore Round-Trip
expected: From the Owner Config archive section, archive some records. The batch appears in the batch history table below. Click "Restore" on that batch — records are restored to the main tables, and a success toast shows the restored count.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

[none yet]
