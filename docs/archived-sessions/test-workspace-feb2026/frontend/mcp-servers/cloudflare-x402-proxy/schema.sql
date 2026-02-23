-- x402 Payments D1 Schema
-- Cloudflare edge database for payment tracking

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  endpoint TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'completed',
  user_agent TEXT,
  ip_country TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
CREATE INDEX IF NOT EXISTS idx_payments_from_address ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_endpoint ON payments(endpoint);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  is_active INTEGER DEFAULT 1,
  monthly_limit_usd REAL DEFAULT 100.00,
  current_month_usage_usd REAL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
