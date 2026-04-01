# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**AI Voice Platform:**
- Vapi - outbound AI phone calls for Morgan and Riley agents
  - SDK/Client: Direct HTTP via `node-fetch` in `voiceGateway.js`
  - Auth: `VAPI_API_KEY` (Bearer token in Authorization header)
  - Endpoints used: `POST https://api.vapi.ai/call` (create call), `GET https://api.vapi.ai/call/{callId}` (poll status)
  - Configured assistants: `VAPI_MORGAN_ASSISTANT_ID`, `VAPI_RILEY_ASSISTANT_ID`
  - Phone numbers: `VAPI_PHONE_NUMBER_IDS` (comma-separated, 3 expected for Morgan slot management) or `VAPI_PHONE_NUMBER_ID`
  - Rate limit handling: 429 triggers 10-second backoff via `rateLimitState.js`, tracked with `setLastVapi429At()`

**CRM / Dialer:**
- Convoso - lead management, call disposition, and call log retrieval
  - SDK/Client: Direct HTTP via `axios` (lead updates) and `node-fetch` (searches) in `index.js`; `fetch` in `apps/ops-api/src/services/convosoCallLogs.ts`
  - Auth: `CONVOSO_AUTH_TOKEN` passed as `auth_token` query parameter (root service) or via env var (ops-api)
  - Endpoints used:
    - `GET https://api.convoso.com/v1/leads/update` - update lead status/notes (root service)
    - `POST https://api.convoso.com/v1/leads/search` - search leads by status/list (root service, form-encoded)
    - `GET https://api.convoso.com/v1/log/retrieve` - fetch call logs for KPI polling (ops-api `convosoCallLogs.ts`)
  - Rate limiting: 3 requests/second queue in `index.js`, exponential backoff on 429 (max 5 retries)
  - Queue ID for ops-api: `CONVOSO_DEFAULT_QUEUE_ID`
  - Webhook secret: `CONVOSO_WEBHOOK_SECRET` (ops-api)

**AI Analysis - Anthropic Claude:**
- Used for structured call audit analysis in `apps/ops-api/src/services/callAudit.ts`
  - SDK: `@anthropic-ai/sdk` 0.78
  - Auth: `ANTHROPIC_API_KEY`
  - Models used: Referenced as `claude-sonnet-4-20250514` in schema `AiUsageLog` model field
  - Usage logged to `ai_usage_logs` table (input/output tokens, estimated cost)
  - Called with tool-use pattern (`submit_call_audit` tool) for structured JSON output

**AI Analysis - OpenAI:**
- Secondary/fallback AI in `apps/ops-api/src/services/callAudit.ts`
  - SDK: `openai` 4.73
  - Auth: `OPENAI_API_KEY`

**Speech-to-Text - Whisper:**
- Self-hosted or external Whisper API for call recording transcription
  - SDK/Client: Direct HTTP `fetch` in `apps/ops-api/src/services/callAudit.ts`
  - Auth: None detected (unauthenticated POST)
  - Endpoint: `WHISPER_API_URL` env var (e.g., `http://localhost:9000/transcribe`)
  - Input: audio buffer as multipart FormData
  - Output: JSON with `text`, `transcription`, or `result` field

## Data Storage

**Databases:**
- PostgreSQL 15 (Alpine in Docker)
  - Connection: `DATABASE_URL` env var (standard PostgreSQL connection string)
  - Client: Prisma Client 5.20 (`@prisma/client`) via `@ops/db` singleton at `packages/db/src/client.ts`
  - Schema: `prisma/schema.prisma`
  - Migrations: `prisma/migrations/`
  - Key models: User, Agent, Sale, Product, LeadSource, PayrollPeriod, PayrollEntry, Clawback, ServiceAgent, ServicePayrollEntry, AppAuditLog, ConvosoCallLog, AiUsageLog, AgentCallKpi, ProcessedConvosoCall, ChargebackSubmission, PayrollAlert, CsRepRoster, PendingTerm

**File Storage:**
- Local filesystem only - recording URLs stored as string references (external URLs from Convoso)

**Caching:**
- None - in-memory queues only (Morgan lead queue in `index.js`)

## Authentication & Identity

**Auth Provider:**
- Custom JWT implementation (`packages/auth/src/index.ts`)
  - Signing: `jsonwebtoken` with `AUTH_JWT_SECRET` (also checks `AUTH_JWT_KEY` as Railway fallback)
  - Expiry: 12 hours
  - Token flow: signed on login -> passed as URL `session_token` param on redirect -> stored in `localStorage` as `ops_session_token`
  - Session cookie: `ops_session` (httpOnly, secure in production, sameSite: lax)
  - Cookie domain: `AUTH_COOKIE_DOMAIN` env var for cross-subdomain sharing
  - Client library: `packages/auth/src/client.ts` - `captureTokenFromUrl()`, `authFetch()` with 30s timeout, auto-refresh when token within 15min of expiry

**Password Hashing:**
- `bcryptjs` 2.4 in `apps/ops-api`

**RBAC Middleware:**
- `requireAuth` -> `requireRole(...roles)` in `apps/ops-api/src/middleware/auth.ts`
- `SUPER_ADMIN` role bypasses all role checks (intentional)
- Roles: `SUPER_ADMIN`, `OWNER_VIEW`, `MANAGER`, `PAYROLL`, `SERVICE`, `ADMIN`, `CUSTOMER_SERVICE`

## Real-time Communication

**WebSockets:**
- Socket.IO 4.8.3 (server: `apps/ops-api/src/socket.ts`)
- Used for: Call audit status updates (`emitAuditStatus`, `emitAuditComplete`), sales board live updates
- Client package: `@ops/socket` (`packages/socket/src/index.ts`) - provides `useSocket` React hook
- Connected from: `apps/ops-dashboard/`, `apps/sales-board/`

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or similar)

**Logs:**
- Morgan service: custom level-gated logger in `index.js` (error/warn/info/debug), controlled by `LOG_LEVEL` env var
- Ops platform: structured JSON logging via `@ops/utils` (`logEvent`, `logError`)
- Audit trail: `AppAuditLog` database table via `logAudit()` in `apps/ops-api/src/services/audit.ts`
- AI usage: `AiUsageLog` database table tracks model, tokens, and estimated cost per call audit

## CI/CD & Deployment

**Hosting:**
- Railway - primary production deployment (per-service, root directory blank/unset for workspace apps)
- Docker Compose - local full-stack development and alternative deployment

**CI Pipeline:**
- None detected (no GitHub Actions, CircleCI, or similar config files)

**Deployment Commands:**
- Morgan voice service: `node index.js`
- ops-api: `prisma migrate deploy && tsx src/index.ts`
- Next.js apps: `next build && next start`
- Docker: `docker-compose up`

## Webhooks & Callbacks

**Incoming:**
- `POST /webhooks/convoso/new-lead` - Convoso fires when a new lead enters qualifying lists; triggers Morgan outbound call via Vapi (`index.js`)
- `POST /webhooks/vapi` - Vapi fires `end-of-call-report` when a call ends; frees Morgan phone slot; logs outcome (`index.js`)

**Outgoing (Tool Callbacks):**
- `POST /tools/sendLeadNote` - Vapi calls this during a live Morgan call to write a note back to Convoso (`index.js`)

**Internal Polling (Cron / Intervals):**
- Every 2 seconds: `processMorganQueueTick()` - launches queued calls into free Vapi phone slots
- Every 60 seconds: `autoPullMorganLeads()` - pulls today's leads from Convoso by call count
- Every 30 seconds: Vapi call status sweep - polls `GET /call/{callId}` to catch calls that ended without a webhook
- Every 30 minutes: `mergeMorganQueueFromMQ()` - merges MQ-status Convoso leads into queue
- Daily 9:15 AM ET (cron): `runMorganPullYesterdayJob()` - pulls yesterday's non-sale leads
- Every 10 minutes: `startConvosoKpiPoller()` in ops-api - polls Convoso call logs per lead source, builds AgentCallKpi snapshots

## Environment Configuration

**Required env vars (Morgan voice service root):**
- `CONVOSO_AUTH_TOKEN` - Convoso API authentication
- `VAPI_API_KEY` - Vapi platform authentication
- `VAPI_MORGAN_ASSISTANT_ID` - Vapi assistant ID for Morgan agent
- `VAPI_PHONE_NUMBER_IDS` - comma-separated Vapi phone number IDs (exactly 3 for Morgan slots)
- `MORGAN_ENABLED` - feature flag (`true`/`false`) to enable/disable Morgan calling
- `PORT` - server port (default: 3000)
- `LOG_LEVEL` - logging verbosity (default: `info`)

**Required env vars (ops-api):**
- `DATABASE_URL` - PostgreSQL connection string (startup fails without)
- `AUTH_JWT_SECRET` - JWT signing secret (startup fails without)
- `ALLOWED_ORIGINS` - comma-separated CORS whitelist matching frontend ports
- `CONVOSO_AUTH_TOKEN` - for KPI poller and call log ingestion
- `CONVOSO_DEFAULT_QUEUE_ID` - Convoso queue ID for call log polling
- `ANTHROPIC_API_KEY` - for Claude call audit AI
- `OPENAI_API_KEY` - for OpenAI/Whisper transcription
- `WHISPER_API_URL` - URL of Whisper transcription service

**Required env vars (Next.js apps):**
- `NEXT_PUBLIC_OPS_API_URL` - browser-reachable API URL (baked at build time)
- `AUTH_JWT_SECRET` - for server-side token verification in middleware

**Secrets location:**
- Local: `.env` files (not committed)
- Production: Railway environment variables
- Docker: `.env` file consumed by `docker-compose.yml`

---

*Integration audit: 2026-03-24*
