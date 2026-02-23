-- Migration: 009-add-x402-payments-schema
-- Description: Add x402 payment protocol schema for bot monetization
-- Date: 2025-12-16

-- Create x402_payments schema
CREATE SCHEMA IF NOT EXISTS x402_payments;

-- Transactions table: Records all x402 payments
CREATE TABLE IF NOT EXISTS x402_payments.transactions (
    id SERIAL PRIMARY KEY,
    payment_id TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount_usd DECIMAL(10, 4) NOT NULL,
    amount_usdc BIGINT NOT NULL,
    endpoint TEXT NOT NULL,
    user_agent TEXT,
    client_ip TEXT,
    tx_hash TEXT,
    network TEXT DEFAULT 'base',
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_x402_transactions_from_address ON x402_payments.transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_x402_transactions_created_at ON x402_payments.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_x402_transactions_endpoint ON x402_payments.transactions(endpoint);
CREATE INDEX IF NOT EXISTS idx_x402_transactions_status ON x402_payments.transactions(status);

-- Daily aggregates table: Pre-computed daily stats for dashboard
CREATE TABLE IF NOT EXISTS x402_payments.daily_aggregates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    total_revenue_usd DECIMAL(10, 4) DEFAULT 0,
    unique_payers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_x402_daily_date ON x402_payments.daily_aggregates(date);

-- Bot clients table: Registered clients for aggregated billing
CREATE TABLE IF NOT EXISTS x402_payments.bot_clients (
    id SERIAL PRIMARY KEY,
    client_id TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
    client_name TEXT NOT NULL,
    contact_email TEXT,
    billing_type TEXT DEFAULT 'instant' CHECK (billing_type IN ('instant', 'aggregated')),
    wallet_address TEXT,
    api_key_hash TEXT UNIQUE,
    monthly_limit_usd DECIMAL(10, 2) DEFAULT 100.00,
    current_month_usage_usd DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x402_clients_api_key ON x402_payments.bot_clients(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_x402_clients_active ON x402_payments.bot_clients(is_active);

-- Client usage logs: Track per-client usage for billing
CREATE TABLE IF NOT EXISTS x402_payments.client_usage (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES x402_payments.bot_clients(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    total_cost_usd DECIMAL(10, 4) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    invoice_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_x402_usage_client ON x402_payments.client_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_x402_usage_period ON x402_payments.client_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_x402_usage_settled ON x402_payments.client_usage(settled);

-- Configuration table: Runtime settings
CREATE TABLE IF NOT EXISTS x402_payments.config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO x402_payments.config (key, value, description) VALUES
    ('enabled', 'true', 'Whether x402 payment enforcement is enabled'),
    ('block_mode', 'false', 'If true, block unpaid requests; if false, log only'),
    ('payment_recipient', '', 'Base wallet address for receiving USDC payments'),
    ('facilitator_url', 'https://x402.coinbase.com', 'Coinbase x402 facilitator URL'),
    ('default_price_usd', '0.001', 'Default price per API request in USD')
ON CONFLICT (key) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION x402_payments.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_bot_clients_updated_at ON x402_payments.bot_clients;
CREATE TRIGGER update_bot_clients_updated_at
    BEFORE UPDATE ON x402_payments.bot_clients
    FOR EACH ROW EXECUTE FUNCTION x402_payments.update_updated_at();

DROP TRIGGER IF EXISTS update_daily_aggregates_updated_at ON x402_payments.daily_aggregates;
CREATE TRIGGER update_daily_aggregates_updated_at
    BEFORE UPDATE ON x402_payments.daily_aggregates
    FOR EACH ROW EXECUTE FUNCTION x402_payments.update_updated_at();

-- View for dashboard statistics
CREATE OR REPLACE VIEW x402_payments.dashboard_stats AS
SELECT
    COUNT(*) as total_transactions,
    COALESCE(SUM(amount_usd), 0) as total_revenue_usd,
    COUNT(DISTINCT from_address) as unique_payers,
    COUNT(DISTINCT endpoint) as unique_endpoints,
    AVG(amount_usd) as avg_transaction_usd,
    MAX(created_at) as last_transaction_at
FROM x402_payments.transactions
WHERE status = 'completed';

-- View for recent transactions
CREATE OR REPLACE VIEW x402_payments.recent_transactions AS
SELECT
    id,
    payment_id,
    from_address,
    amount_usd,
    endpoint,
    status,
    created_at
FROM x402_payments.transactions
ORDER BY created_at DESC
LIMIT 100;

-- Grant permissions (adjust as needed for your setup)
-- GRANT USAGE ON SCHEMA x402_payments TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA x402_payments TO your_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA x402_payments TO your_app_user;

COMMENT ON SCHEMA x402_payments IS 'x402 payment protocol schema for bot monetization';
COMMENT ON TABLE x402_payments.transactions IS 'All x402 payment transactions from bots/AI agents';
COMMENT ON TABLE x402_payments.bot_clients IS 'Registered bot clients for aggregated billing';
COMMENT ON TABLE x402_payments.daily_aggregates IS 'Pre-computed daily revenue statistics';
COMMENT ON TABLE x402_payments.client_usage IS 'Per-client usage tracking for monthly billing';
COMMENT ON TABLE x402_payments.config IS 'Runtime configuration for x402 system';
