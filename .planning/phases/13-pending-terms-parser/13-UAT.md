---
status: testing
phase: 13-pending-terms-parser
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md]
started: 2026-03-17T21:10:00Z
updated: 2026-03-17T21:10:00Z
---

## Current Test

number: 1
name: Paste Pending Terms Text and See Parsed Preview
expected: |
  In the CS Dashboard Submissions tab, paste raw pending terms text into the textarea. Parsed records appear in an editable preview table with 6 columns: Member Name, Member ID, Product, Monthly Amt, Hold Date, Assigned To.
awaiting: user response

## Tests

### 1. Paste Pending Terms Text and See Parsed Preview
expected: In the CS Dashboard Submissions tab, paste raw pending terms text into the textarea. Parsed records appear in an editable preview table with 6 columns: Member Name, Member ID, Product, Monthly Amt, Hold Date, Assigned To.
result: [pending]

### 2. Multi-Record Detection by Agent Pattern
expected: Pasting text containing multiple agent sections (each starting with "Company - Agent Name (ID)" pattern) produces separate record groups, all sharing the same batch_id. Each 3-line block is joined correctly into a single record.
result: [pending]

### 3. Member Consolidation and Amount Summation
expected: When the same member ID appears in multiple records, they are consolidated into one row. Products are deduplicated and monthly amounts are summed together.
result: [pending]

### 4. Editable vs Read-Only Columns
expected: In the preview table, Member ID and Product columns are read-only (not editable). Member Name, Monthly Amt, Hold Date, and Assigned To columns are editable inline.
result: [pending]

### 5. Round-Robin Rep Assignment
expected: When reps are added to the rep roster sidebar, pending terms records are automatically assigned to reps in round-robin order. Changing the rep roster re-assigns both chargeback and pending terms records.
result: [pending]

### 6. Submit Parsed Records to Database
expected: Clicking the submit button sends all parsed records to the API. On success (201), records are persisted with raw_paste, submitted_by, and submitted_at populated. The preview table clears after successful submission.
result: [pending]

### 7. Malformed or Missing Fields
expected: Pasting text with missing or malformed fields (e.g., no dollar amount, bad date format) does not crash the parser or block submission. Missing values are stored as null.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
