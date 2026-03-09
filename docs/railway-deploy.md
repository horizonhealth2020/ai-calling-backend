# Railway Deployment Safety (Morgan + Ops Monorepo)

## Critical isolation rule

Morgan voice agent is a separate service and must deploy from repository root (`.`).
Do not configure Morgan to build from `apps/*` and do not configure ops services to build from root.

## Service mapping

| Service | Root directory | Build | Start |
|---|---|---|---|
| morgan-voice | `.` | `npm ci` | `npm start` |
| ops-api | `apps/ops-api` | `npm install && npm run build` | `npm run start` |
| auth-portal | `apps/auth-portal` | `npm install && npm run build` | `npm run start` |
| manager-dashboard | `apps/manager-dashboard` | `npm install && npm run build` | `npm run start` |
| payroll-dashboard | `apps/payroll-dashboard` | `npm install && npm run build` | `npm run start` |
| owner-dashboard | `apps/owner-dashboard` | `npm install && npm run build` | `npm run start` |
| sales-board | `apps/sales-board` | `npm install && npm run build` | `npm run start` |

## Morgan environment variables (unchanged)

- `CONVOSO_AUTH_TOKEN`
- `VAPI_API_KEY`
- `VAPI_MORGAN_ASSISTANT_ID`
- `VAPI_PHONE_NUMBER_IDS`
- `MORGAN_ENABLED`
- `PORT`
- `LOG_LEVEL`

