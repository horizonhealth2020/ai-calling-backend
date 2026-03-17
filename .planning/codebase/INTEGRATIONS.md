# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**AI Call Auditing (primary):**
- Anthropic Claude — Structured call transcript auditing using tool-use API
  - SDK/Client: `@anthropic-ai/sdk` ^0.78.0
  - Model: `claude-sonnet-4-20250514`
  - Auth: `ANTHROPIC_API_KEY` env var
  - Integration: `apps/ops-api/src/services/callAudit.ts` — `auditWithClaude()`
  - Uses forced tool-use (`submit_call_audit`) for structured JSON output with issues, wins, coaching, and manager summary

**AI Call Auditing (fallback):**
- OpenAI GPT-4o-mini — Legacy fallback when `ANTHROPIC_API_KEY` is not set
  - SDK/Client: `openai` ^4.73.0
  - Model: `gpt-4o-mini`
  - Auth: `OPENAI_API_KEY` env var
  - Integration: `apps/ops-api/src/services/callAudit.ts` — `auditWithOpenAI()`

**Speech-to-Text:**
- Whisper (self-hosted or third-party endpoint) — Transcribes call recordings before auditing
  - Client: Native `fetch`
  - Auth: None (URL-based)
  - Config: `WHISPER_API_URL` env var (required for audio transcription)
  - Integration: `apps/ops-api/src/services/callAudit.ts` — `transcribeRecording()`

**Outbound AI Calling:**
- Vapi — Voice AI platform for outbound calls via Morgan and Riley agents
  - Client: Native `fetch` to `https://api.vapi.ai/call`
  - Auth: `VAPI_API_KEY` env var (Bearer token)
  - Config: `VAPI_MORGAN_ASSISTANT_ID`, `VAPI_RILEY_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` / `VAPI_PHONE_NUMBER_IDS` (comma-separated for round-robin)
  - Integration: `voiceGateway.js` — `startOutboundCall()`
  - Rate limit: 429 responses trigger backoff state in `rateLimitState.js`; tracked via `VAPI_429_BACKOFF_MS` (10s)

**Dialer / CRM / Call Logs:**
- Convoso — Outbound dialer; provides call log data and triggers Morgan via webhooks
  - Client: Native `fetch` to `https://api.convoso.com/v1/log/retrieve`
  - Auth: `CONVOSO_AUTH_TOKEN` env var (Bearer token)
  - Config: `CONVOSO_DEFAULT_QUEUE_ID` env var (required for KPI polling)
  - Integrations:
    - `apps/ops-api/src/services/convosoCallLogs.ts` — `fetchConvosoCallLogs()`, KPI aggregation
    - `apps/ops-api/src/workers/convosoKpiPoller.ts` — 10-minute polling worker that persists snapshots to `AgentCallKpi` table
    - `index.js` — Convoso webhook receiver that triggers Morgan outbound calls
  - Webhook secret: `CONVOSO_WEBHOOK_SECRET` env var (used in `index.js` for inbound webhook validation)

## Data Storage

**Databases:**
- PostgreSQL 15 — Primary database
  - Connection: `DATABASE_URL` env var (full connection string)
  - Client: Prisma ORM (`@prisma/client` 5.20) via `@ops/db` singleton (`packages/db/src/client.ts`)
  - Schema: `prisma/schema.prisma`
  - Migrations: `prisma/migrations/`
  - Key tables: `users`, `agents`, `sales`, `products`, `lead_sources`, `payroll_periods`, `payroll_entries`, `clawbacks`, `service_agents`, `service_payroll_entries`, `call_audits`, `convoso_call_logs`, `agent_call_kpis`, `processed_convoso_calls`, `app_audit_log`, `sales_board_settings`, `service_tickets`

**File Storage:**
- No external file storage service detected. Recording URLs stored as strings (pointing to Convoso-hosted recordings). Audio is fetched as buffers at audit time — not persisted locally.

**Caching:**
- None — No Redis or in-memory cache layer. KPI deduplication uses `processed_convoso_calls` table. Morgan call queue is in-process memory (`morganQueue` array, `morganQueuedIds` Set in `index.js`).

## Authentication & Identity

**Auth Provider:**
- Custom JWT (no third-party auth provider)
  - Implementation: `packages/auth/src/index.ts` (server-side signing/verification), `packages/auth/src/client.ts` (browser-side)
  - Token: JWT signed with `AUTH_JWT_SECRET` (HS256 implied by `jsonwebtoken`), 12h expiry
  - Delivery: Passed via URL `session_token` param on redirect, stored in localStorage as `ops_session_token`; also set as HttpOnly cookie `ops_session` for server-side use
  - Cookie domain: `AUTH_COOKIE_DOMAIN` env var (enables cross-subdomain sharing)
  - Auto-refresh: Client refreshes token when within 15 minutes of expiry (`packages/auth/src/client.ts` — `authFetch()`)
  - RBAC: `requireAuth` + `requireRole()` middleware in `apps/ops-api/src/middleware/auth.ts`; `SUPER_ADMIN` bypasses all role checks

**Password Hashing:**
- bcryptjs 2.4 — used during login in `apps/ops-api/`

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Datadog, or equivalent SDK

**Logs:**
- Structured JSON logging via `@ops/utils` (`packages/utils/src/index.ts`) — `logEvent()` and `logError()` write `{ level, event, payload, ts }` to stdout/stderr
- ops-api uses `console.log(JSON.stringify({...}))` directly in workers (`convosoKpiPoller.ts`)
- Morgan voice service uses a custom logger with `LOG_LEVEL` env var (error/warn/info/debug levels)

**Audit Trail:**
- Internal `app_audit_log` table — sensitive operations call `logAudit()` from `apps/ops-api/src/services/audit.ts`

## CI/CD & Deployment

**Hosting:**
- Railway — primary deployment target (per-service, each app deployed independently)
- Docker — full-stack local deployment via `docker-compose.yml`

**CI Pipeline:**
- None detected — no GitHub Actions, CircleCI, or equivalent config files found

## Real-Time Communication

**WebSockets:**
- Socket.IO 4.8.3 — server mounted on ops-api HTTP server (`apps/ops-api/src/index.ts`)
- Events emitted during call audit pipeline: `audit:status` and `audit:complete` (`apps/ops-api/src/socket.ts`)
- Clients: `manager-dashboard`, `owner-dashboard`, `payroll-dashboard`, `sales-board` all use `socket.io-client` via `@ops/socket` package

## Webhooks & Callbacks

**Incoming:**
- Convoso webhook → Morgan trigger: `POST /webhook/convoso` in `index.js` — receives dialer events and enqueues outbound AI calls
- Vapi webhooks: Referenced in `index.js` — handles call status updates from Vapi

**Outgoing:**
- Vapi `POST https://api.vapi.ai/call` — initiates outbound calls (`voiceGateway.js`)
- Convoso `GET https://api.convoso.com/v1/log/retrieve` — polling for call logs (`apps/ops-api/src/services/convosoCallLogs.ts`)
- Anthropic `messages.create` — call audit (`apps/ops-api/src/services/callAudit.ts`)
- OpenAI `chat.completions.create` — fallback call audit (`apps/ops-api/src/services/callAudit.ts`)
- Whisper endpoint (configurable) — audio transcription (`apps/ops-api/src/services/callAudit.ts`)

## Environment Configuration

**Required env vars (ops-api):**
- `DATABASE_URL` — Startup fails without it
- `AUTH_JWT_SECRET` — Startup fails without it

**Required env vars (ops-api, feature-gated):**
- `CONVOSO_AUTH_TOKEN` — Enables Convoso KPI poller and call log routes; silently disabled when absent
- `CONVOSO_DEFAULT_QUEUE_ID` — Required for KPI poller to run
- `CONVOSO_WEBHOOK_SECRET` — Webhook validation in Morgan service
- `ANTHROPIC_API_KEY` — Enables Claude-based call auditing; falls back to OpenAI when absent
- `OPENAI_API_KEY` — Used as audit fallback when `ANTHROPIC_API_KEY` is not set
- `WHISPER_API_URL` — Required for audio transcription before auditing

**Required env vars (Morgan voice service, root):**
- `VAPI_API_KEY` — Required to initiate any outbound call
- `VAPI_MORGAN_ASSISTANT_ID` — Vapi assistant ID for Morgan agent
- `VAPI_RILEY_ASSISTANT_ID` — Vapi assistant ID for Riley agent (optional)
- `VAPI_PHONE_NUMBER_ID` / `VAPI_PHONE_NUMBER_IDS` — One or more Twilio numbers registered in Vapi

**Optional env vars:**
- `ALLOWED_ORIGINS` — CORS whitelist (defaults to all five dashboard localhost ports)
- `AUTH_COOKIE_DOMAIN` — Cookie domain for cross-subdomain session sharing
- `AUTH_PORTAL_URL`, `MANAGER_DASHBOARD_URL`, `PAYROLL_DASHBOARD_URL`, `OWNER_DASHBOARD_URL` — Redirect targets after login
- `NEXT_PUBLIC_OPS_API_URL` — API URL baked into Next.js builds (must be browser-reachable)
- `NEXT_OUTPUT_STANDALONE` — Enables Next.js standalone output (Docker only)
- `LOG_LEVEL` — Morgan logger verbosity (error/warn/info/debug)
- `PORT` — API server port (defaults to 8080)

**Secrets location:**
- Environment variables only — no secrets files committed. Docker Compose reads from shell env or `.env` file at compose root.

---

*Integration audit: 2026-03-17*
