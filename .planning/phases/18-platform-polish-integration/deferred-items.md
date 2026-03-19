# Deferred Items - Phase 18

## Pre-existing TypeScript Errors

### Payroll Dashboard - SaleAddonInfo Type Mismatch
- **File:** `apps/payroll-dashboard/app/page.tsx` line 1304
- **Error:** `Type '{ product: { id: string; name: string; type: string; }; }[]' is not assignable to type 'SaleAddonInfo[]'` - missing `productId` and `premium` properties
- **Found during:** Plan 08 verification
- **Impact:** Non-blocking (runtime works, TypeScript strict check fails)
- **Suggested fix:** Update the Socket.IO payload mapping to include `productId` and `premium` fields on addon objects
