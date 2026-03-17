CREATE TABLE IF NOT EXISTS processed_convoso_calls (
  id TEXT PRIMARY KEY,
  convoso_call_id TEXT NOT NULL UNIQUE,
  lead_source_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_convoso_calls_processed_at ON processed_convoso_calls (processed_at);
