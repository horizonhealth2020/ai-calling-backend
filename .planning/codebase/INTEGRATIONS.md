# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Voice/Calling Platform:**
- Vapi - AI voice platform for outbound calls
  - SDK/Client: `voiceGateway.js` uses native fetch for HTTP calls
  - Auth: `VAPI_API_KEY` environment variable
  - Usage: `startOutboundCall()` function in `voiceGateway.js` manages outbound call initiation
  - Phone Numbers: `VAPI_PHONE_NUMBER_IDS` (comma-separated, 3 slots for Morgan concurrent calls) or single fallback `VAPI_PHONE_NUMBER_ID`
  - Assistants: `VAPI_MORGAN_ASSISTANT_ID` and `VAPI_RILEY_ASSISTANT_ID` (agent-specific)
  - Features: Rate limiting with 10s backoff on 429 errors, Morgan slot management for concurrent call limits

**CRM Integration:**
- Convoso - Sales CRM and dialing platform
  - SDK/Client: Direct HTTP API calls via axios in `index.js`
  - Auth: `CONVOSO_AUTH_TOKEN` environment variable
  - Webhook endpoint: Root Express app receives Convoso webhook to trigger Morgan outbound calls
  - Webhook Secret: `CONVOSO_WEBHOOK_SECRET` (for request validation, in `apps/ops-api/.env.example`)
  - Usage: Lead updates via `https://api.convoso.com/v1/leads/update` (queued to prevent race conditions)
  - Data synced: Lead ID, phone, first/last name, call count, list ID, member ID

**Speech-to-Text:**
- OpenAI Whisper API - Audio transcription (primary)
  - SDK/Client: `openai` npm package
  - Auth: `OPENAI_API_KEY` environment variable (required for call audit transcription)
  - Usage: In `apps/ops-api/src/services/callAudit.ts` for transcribing call audio

- Local Whisper Server (fallback/alternative)
  - URL: `WHISPER_API_URL` environment variable (e.g., `http://localhost:9000/transcribe`)
  - Purpose: On-premise transcription alternative

## AI & LLM Services

**Claude (Anthropic) - Call Audit Analysis:**
- SDK: `@anthropic-ai/sdk` 0.78.0
- Auth: `ANTHROPIC_API_KEY` environment variable (required for re-audit feature)
- Usage: `apps/ops-api/src/services/callAudit.ts` uses Claude's tool calling API for structured call analysis
- Tool: `submit_call_audit` tool with schema covering:
  - Agent name, call outcome (sold/callback/lost/not_qualified/incomplete)
  - Issues: Specific coaching moments with direct quotes from transcript
  - Wins: Agent strengths demonstrated in the call
  - Missed opportunities: Moments where agent should have spoken
  - Suggested coaching: Top 1-3 priorities for manager
  - Manager summary: 2-3 sentence executive summary
- Real-time Updates: Emits Socket.io events during audit processing (status, complete, failed)

**OpenAI - Alternative LLM (fallback):**
- SDK: `openai` npm package 4.73.0
- Auth: `OPENAI_API_KEY` environment variable
- Usage: Fallback if Claude unavailable; used for transcription via Whisper API

## Data Storage

**Databases:**
- PostgreSQL 15 (primary)
  - Connection: `DATABASE_URL` environment variable
  - Format: `postgresql://user:password@host:port/database`
  - Docker Compose: `postgres:15-alpine` with credentials from `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - Healthcheck: Required before API/app containers start (waits for `pg_isready`)

**Client:**
- Prisma ORM (`@prisma/client` 5.20.0)
- Singleton instance in `packages/db/src/client.ts`
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/` (deployed via `prisma migrate deploy`)

**File Storage:**
- Not detected - applications use PostgreSQL only

**Caching:**
- Not detected - no Redis or Memcached in dependencies

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no third-party provider)
  - Implementation: `packages/auth/src/index.ts` (server-side) and `packages/auth/src/client.ts` (browser-side)
  - JWT Secret: `AUTH_JWT_SECRET` environment variable (required at startup)
  - Token Expiry: 12 hours

**Server-Side Session Management:**
- Token signing: `signSessionToken()` in `packages/auth/src/index.ts`
- Token verification: `verifySessionToken()` validates JWT signature
- Session cookie: `ops_session` httpOnly cookie, secure in production, sameSite=lax
- Cookie domain: `AUTH_COOKIE_DOMAIN` environment variable (for cross-subdomain sharing)
- Endpoints:
  - `POST /api/auth/login` - Email/password authentication, returns JWT token
  - `POST /api/auth/logout` - Clears session cookie
  - `POST /api/auth/change-password` - Update user password
  - `GET /api/auth/refresh` - Refresh token (requires valid token)

**Browser-Side Session Management:**
- Token capture: `captureTokenFromUrl()` reads `session_token` URL param from redirect
- Token storage: localStorage key `ops_session_token`
- Auto-refresh: `authFetch()` wrapper refreshes token when within 15 minutes of expiry
- Request injection: Bearer token header added to all API calls via `authFetch()`
- Request timeout: 30 seconds

**RBAC (Role-Based Access Control):**
- Roles: `SUPER_ADMIN`, `OWNER_VIEW`, `MANAGER`, `PAYROLL`, `SERVICE`, `ADMIN`
- Enforcement: Middleware `requireAuth` and `requireRole(...roles)` in `apps/ops-api/src/middleware/auth.ts`
- Special case: `SUPER_ADMIN` bypasses all role checks (intentional)
- User model: `packages/types/src/index.ts` exports `AppRole` and `SessionUser` types

## Monitoring & Observability

**Error Tracking:**
- Not detected - no Sentry, Rollbar, or similar

**Logs:**
- Structured JSON logging via `@ops/utils` package (`logEvent`, `logError`)
- Audit logging: `logAudit()` in `apps/ops-api/src/services/audit.ts` writes to `app_audit_log` table for sensitive operations
- Console logging with levels: error, warn, info, debug (controlled by `LOG_LEVEL` env var in Morgan service)
- Socket.io events emitted for real-time audit status tracking (via `apps/ops-api/src/socket.ts`)

## CI/CD & Deployment

**Hosting:**
- Railway (primary - per README.md)
- Docker Compose (local development or on-premise)

**CI Pipeline:**
- Not detected - no GitHub Actions, GitLab CI, or similar in codebase

**Build & Deployment:**
- Railway per-service build/start commands (defined in README.md)
- Docker:
  - `Dockerfile.nextjs` - Builds Next.js apps with `APP_NAME` build arg
  - `docker-compose.yml` - Orchestrates postgres + ops-api + 5 frontend services
  - Conditional standalone output: `output: "standalone"` only when `NEXT_OUTPUT_STANDALONE=true`
  - Build-time `NEXT_PUBLIC_OPS_API_URL` injection for frontend apps

## Environment Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (startup fails without it)
- `AUTH_JWT_SECRET` - JWT signing secret (startup fails without it)
- `OPENAI_API_KEY` - OpenAI API key for transcription
- `ANTHROPIC_API_KEY` - Anthropic API key for call audit analysis

**Integration Environment Variables:**
- `CONVOSO_AUTH_TOKEN` - CRM webhook authentication token
- `VAPI_API_KEY` - Voice platform API key
- `VAPI_MORGAN_ASSISTANT_ID` - Morgan AI assistant ID
- `VAPI_RILEY_ASSISTANT_ID` - Riley AI assistant ID (optional)
- `VAPI_PHONE_NUMBER_IDS` - Comma-separated phone number IDs (exactly 3 for Morgan)
- `CONVOSO_WEBHOOK_SECRET` - Webhook validation secret

**Configuration Environment Variables:**
- `PORT` - API server port (default: 3000 for Morgan, 8080 for ops-api)
- `NODE_ENV` - Environment (production/development)
- `LOG_LEVEL` - Logging verbosity (error, warn, info, debug)
- `ALLOWED_ORIGINS` - CORS whitelist (comma-separated URLs)
- `NEXT_PUBLIC_OPS_API_URL` - Browser-reachable API URL
- `AUTH_COOKIE_DOMAIN` - Cookie domain for cross-subdomain sessions
- `MORGAN_ENABLED` - Toggle for Morgan voice service (true/false)
- `WHISPER_API_URL` - Local Whisper transcription endpoint

**Docker Compose Postgres Variables:**
- `POSTGRES_USER` - Database user (default: ops)
- `POSTGRES_PASSWORD` - Database password (default: ops_secret)
- `POSTGRES_DB` - Database name (default: ops_prod)

## Webhooks & Callbacks

**Incoming:**
- Convoso Webhook - Triggers Morgan outbound call initiation
  - Endpoint: Root Express server (undefined path in codebase)
  - Payload: Lead data from Convoso CRM
  - Security: Validated via `CONVOSO_WEBHOOK_SECRET`
  - Processing: Queued to prevent race conditions

**Outgoing (via Socket.io):**
- Real-time audit status events: `audit_status`, `processing_started`, `processing_failed`, `new_audit`
  - Emitted from `apps/ops-api/src/socket.ts` during call audit analysis
  - Received by connected browser clients (manager dashboard listening for updates)

---

*Integration audit: 2026-03-14*
