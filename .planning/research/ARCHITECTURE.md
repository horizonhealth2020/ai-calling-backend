# Architecture Research

**Project:** Ops Platform — Payroll & Usability Overhaul
**Dimension:** Architecture
**Confidence:** HIGH

## Current Architecture Issues

### Critical Bugs Found

1. **Sale creation 500 error:** `payroll.ts` references `sale.memberState` but the field doesn't exist on Prisma Sale model. Every sale creation attempt crashes.

2. **Week-in-arrears NOT implemented:** `getSundayWeekRange(saleDate)` assigns sales to the week containing the sale date. Requirement is the following Sun-Sat period. ACH double-delay is not coded.

3. **Socket.IO only broadcasts audit events:** Sale creation, payroll mutations, and clawbacks emit no socket events. Dashboard cascade requires extending the socket layer.

4. **SaleAddon has no per-addon premium:** All addon commission calculations reuse `sale.premium`.

5. **Compass VAB detection uses string matching:** `product.name.includes("Compass VAB")` — renaming breaks all commission calculations silently.

## Component Boundaries

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| Manager Dashboard | Sale entry form, agent tracker | ops-api (HTTP + Socket.IO) |
| Payroll Dashboard | Period management, commission review, exports | ops-api (HTTP + Socket.IO) |
| Owner Dashboard | KPI display, trend analysis | ops-api (HTTP) |
| Sales Board | Leaderboard display | ops-api (HTTP + Socket.IO) |
| ops-api Routes | Request validation, auth, routing | Payroll Service, Prisma, Socket.IO |
| Payroll Service | Commission calculation, period assignment | Prisma |
| Socket.IO Layer | Real-time event broadcasting | All dashboards |
| Prisma/PostgreSQL | Data persistence, transactions | ops-api |
| Auth System | JWT, RBAC, session management | All components |

## Data Flow: Sale Entry to Dashboard Cascade

### Current (Broken)
```
Manager Dashboard -> POST /api/sales -> Zod validation -> Create Sale
  -> upsertPayrollEntryForSale() -> 500 ERROR (memberState undefined)
  -> No Socket.IO events emitted
  -> No dashboard updates
```

### Target Flow
```
Manager Dashboard -> POST /api/sales -> Zod validation -> Create Sale + SaleAddons
  -> calculateCommission(sale, products, addons, bundleRules)
  -> getArrearsPayPeriod(saleDate, paymentType) -> correct Sun-Sat period
  -> upsertPayrollEntry(agentId, periodId, commission)
  -> Socket.IO emit:
      -> "sale:created" -> Manager (agent tracker), Sales Board (leaderboard)
      -> "payroll:updated" -> Payroll Dashboard (card refresh)
      -> "kpi:refresh" -> Owner Dashboard (aggregates)
  -> Return sale with commission preview
```

### Commission Calculation Flow (Target)
```
Input: sale { products[], premium, enrollmentFee, paymentType }

For each product:
  1. Determine type: CORE | ADDON | AD_D
  2. Check bundle status:
     - CORE: Is Compass VAB in sale's products? (by product flag, not name)
       -> Yes: full commission rate
       -> No: half commission rate
     - ADDON/AD_D: Is a CORE product in this sale?
       -> Yes (bundled): half commission from set rate
       -> No (standalone): half commission from set rate
  3. Apply enrollment fee rules:
     - Below product threshold -> half commission
     - Exactly $125 -> +$10 bonus
  4. Sum all product commissions -> total sale commission

Period assignment:
  - Standard: next Sun-Sat period after sale date
  - ACH: skip one additional week (two weeks out)
```

## Recommended Changes

### 1. Pure Commission Service
Extract commission calculation into pure, testable functions:
- `calculateProductCommission(product, isBundled, enrollmentFee)` -> number
- `calculateSaleCommission(sale, products)` -> { total, breakdown[] }
- `getPayPeriod(saleDate, paymentType)` -> { startDate, endDate, periodId }

### 2. Bundle Detection by Product Flag
Add `isBundleQualifier: Boolean` field to Product model instead of string matching on product name.

### 3. Socket.IO Sale Events
Extend `socket.ts` with:
- `sale:created` -> broadcast to manager room + salesboard room
- `payroll:updated` -> broadcast to payroll room
- `kpi:refresh` -> broadcast to owner room

### 4. Arrears Period Logic
New function `getArrearsPayPeriod(saleDate, paymentType)`:
- Find the Sun-Sat week containing saleDate
- Offset by +1 week (standard arrears)
- If ACH: offset by +2 weeks total

## Build Order (Dependency Chain)

| Step | What | Why First |
|------|------|-----------|
| 1 | Fix sale creation (memberState, schema) | Unblocks ALL testing |
| 2 | Fix arrears period assignment | Data correctness before UI |
| 3 | Fix Compass VAB detection (flag, not string) | Commission accuracy |
| 4 | Add Socket.IO sale/payroll events | Enables cascade |
| 5 | Multi-product sale form (manager) | Frontend for multi-product |
| 6 | Commission calculation verification + tests | Validate all rules |
| 7 | Payroll dashboard cascade + scrollable cards | UI for payroll |
| 8 | Sales board + Owner dashboard cascade | Remaining dashboards |
| 9 | Reporting + export | Requires correct data |

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Do Instead |
|-------------|-----|------------|
| Client-side commission calculation | Payroll must be server-authoritative | Calculate on API, display preview |
| Socket.IO as primary data transport | Unreliable for financial data | HTTP for writes, Socket for notifications |
| Split payroll logic across services | Commission rules must be centralized | Single payroll service module |
| Flat routes file growth | routes/index.ts is already large | Consider route grouping by domain |

---
*Research completed: 2026-03-14*
