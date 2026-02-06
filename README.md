# AI Calling Backend

Express.js webhook orchestration engine for automated AI-powered outbound calling using Convoso CRM and Vapi AI voice platform.

## Architecture

This application manages a queued outbound calling system where leads from Convoso CRM are processed through Vapi AI voice agents (Morgan) for qualification calls.

**Key Components:**
- Express.js REST API with webhook endpoints
- In-memory queue with Convoso persistence
- Slot-based rate limiting (3 concurrent calls)
- Business hours enforcement (9 AM - 5 PM ET, Mon-Fri, with lunch break)

## Prerequisites

- Node.js 12+ (no TypeScript, no build step)
- Convoso CRM account with API access
- Vapi AI account with assistant configured
- 3 Vapi phone numbers (for concurrent calling)

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `CONVOSO_AUTH_TOKEN` | Convoso API authentication token | Yes |
| `VAPI_API_KEY` | Vapi AI API key | Yes |
| `VAPI_MORGAN_ASSISTANT_ID` | Vapi assistant ID for Morgan | Yes |
| `VAPI_PHONE_NUMBER_IDS` | Comma-separated Vapi phone IDs (exactly 3) | Yes |
| `PORT` | Server port (default: 3000) | No |
| `LOG_LEVEL` | Logging level: error, warn, info, debug (default: info) | No |
| `MORGAN_ENABLED` | Enable/disable Morgan calling (default: true) | No |

## Running the Application

```bash
npm start
```

Server will start on port 3000 (or specified PORT).

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

### Health Check

- `GET /` - Basic health check
- `GET /health` - Health check with version info

### Jobs

- `POST /jobs/morgan/pull-leads` - Pull today's leads (call_count=2 or 5)
  - Optional body: `{ "limit": 50 }`
  - Response: `{ success: true, fetched: N, queue_length: N }`

- `POST /jobs/morgan/pull-yesterday` - Pull previous business day's non-sale leads
  - Optional body: `{ "timezone": "America/New_York" }`
  - Response: `{ success: true, fetched: N, queue_length: N }`

### Webhooks

- `POST /webhooks/convoso/new-lead` - Convoso webhook for instant outbound calls
  - Accepts Convoso lead payload
  - Triggers immediate Morgan call if lead qualifies

- `POST /webhooks/vapi` - Vapi AI webhook for call events
  - Handles end-of-call reports
  - Frees call slots
  - Posts call summaries to Convoso

### Tools

- `POST /tools/sendLeadNote` - Called by Vapi to log notes to Convoso
  - Called during/after AI calls
  - Truncates notes to 255 characters

### Debug

- `POST /debug/test-call` - Manual test call
  - Body: `{ "phone": "+13055551234" }`

- `POST /debug/hydrate-mq` - Debug MQ lead fetching

- `POST /debug/hydrate-mq-raw` - Debug raw MQ data

## How It Works

### 1. Lead Acquisition

Leads enter the queue via:
- **Auto-pull**: Every 60 seconds, pulls leads with call_count=2 or 5 (created today)
- **Scheduled pull**: Daily at 9:15 AM ET, pulls previous business day's leads
- **Webhook**: Instant trigger on new lead from Convoso
- **Periodic merge**: Every 30 minutes, syncs leads with MQ status from Convoso

### 2. Queue Processing

- Queue processor runs every 2 seconds
- Checks for available slots (max 3 concurrent calls)
- Pulls next lead and launches Vapi call
- Updates lead status: `MQ` (queued) → `MC` (calling)

### 3. Call Lifecycle

```
Lead → Queue (MQ) → Call Started (MC) → Call Ends → Slot Freed
                                      ↓
                               Note Posted to Convoso
```

### 4. Business Hours

Calls only occur during:
- Monday - Friday
- 9:00 AM - 1:00 PM ET (morning)
- 2:30 PM - 5:00 PM ET (afternoon)
- Lunch break: 1:00 PM - 2:30 PM ET (no calls)

### 5. Lead Filtering

Leads are **skipped** if:
- `Member_ID` field is populated (already a member)
- No phone number present
- Status is already `MC` or `MQ`

## Morgan List IDs

The system targets these Convoso lists:
```javascript
[28001, 15857, 27223, 10587, 12794, 12793]
```

## Status Codes

| Status | Description |
|--------|-------------|
| `MQ` | Morgan Queue - waiting to be called |
| `MC` | Morgan Calling - actively being called or recently called |

## Deployment

Deployed on [Railway.app](https://railway.app):
- Production URL: `https://ai-calling-backend-production-cd41.up.railway.app`
- Automatic deployments from `main` branch

## GitHub Actions

Two automated workflows:

1. **morgan-pull-leads-now.yml** - Manual trigger to pull leads immediately
2. **morgan-pull-yesterday-leads.yml** - Weekday 9:15 AM ET automated pull

## File Structure

```
.
├── index.js               # Main application (1,562 lines)
├── voiceGateway.js        # Vapi AI client integration
├── morganToggle.js        # Morgan enable/disable control
├── rateLimitState.js      # Rate limit tracking for 429 backoff
├── timeUtils.js           # Business hours logic
├── package.json           # Dependencies
├── jest.config.js         # Test configuration
├── .env.example           # Environment variable template
├── __tests__/             # Test suite
│   ├── helpers.test.js
│   ├── morganToggle.test.js
│   ├── rateLimitState.test.js
│   ├── timeUtils.test.js
│   └── voiceGateway.test.js
├── .github/
│   └── workflows/
│       ├── morgan-pull-leads-now.yml
│       └── morgan-pull-yesterday-leads.yml
└── ISSUES.md              # Known issues and tech debt

```

## Known Issues

See [ISSUES.md](ISSUES.md) for a comprehensive list of 22 documented issues including:
- Race conditions in queue processor
- Memory leaks in ID tracking
- Missing input validation
- Error handling improvements needed

## Contributing

This project uses a PR-based workflow. Please:
1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Submit PR for review

## License

Internal use only - Horizon Health 2020

## Support

For issues or questions, contact the development team or open an issue on GitHub.
