-- ============================================================================
-- Migration: 003-subscriptions-and-paypal-removal.sql
-- Created: November 28, 2025
-- Purpose:
--   1. Remove PayPal from payment processor constraint
--   2. Add subscription tracking columns to donations table
--   3. Create subscriptions table for recurring donation management
-- ============================================================================

-- ============================================================================
-- PART 1: Remove PayPal from payment processor constraint
-- ============================================================================

-- Drop existing constraint
ALTER TABLE donations.donations
DROP CONSTRAINT IF EXISTS donations_processor_valid;

-- Add updated constraint without PayPal
ALTER TABLE donations.donations
ADD CONSTRAINT donations_processor_valid
CHECK (payment_processor IN ('stripe', 'btcpay', 'other'));

-- Migrate any existing PayPal donations to 'other'
UPDATE donations.donations
SET payment_processor = 'other'
WHERE payment_processor = 'paypal';

-- ============================================================================
-- PART 2: Add subscription tracking columns to donations table
-- ============================================================================

-- Add columns for Stripe subscription tracking
ALTER TABLE donations.donations
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50);

-- Add indexes for subscription lookups
CREATE INDEX IF NOT EXISTS idx_donations_subscription_id
ON donations.donations(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_customer_id
ON donations.donations(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_is_recurring
ON donations.donations(is_recurring)
WHERE is_recurring = TRUE;

-- Comments
COMMENT ON COLUMN donations.donations.stripe_subscription_id IS 'Stripe subscription ID for recurring donations';
COMMENT ON COLUMN donations.donations.stripe_customer_id IS 'Stripe customer ID for portal access';
COMMENT ON COLUMN donations.donations.is_recurring IS 'True if this donation is part of a recurring subscription';
COMMENT ON COLUMN donations.donations.subscription_status IS 'Current status of the subscription (active, past_due, canceled, etc.)';

-- ============================================================================
-- PART 3: Create subscriptions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS donations.subscriptions (
  id BIGSERIAL PRIMARY KEY,

  -- Stripe identifiers
  stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,

  -- Donor info
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255),
  user_id BIGINT, -- NULL for guest subscriptions

  -- Subscription details
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  interval VARCHAR(20) DEFAULT 'month', -- 'month' or 'year'

  -- Project allocation (simplified - single project per subscription)
  project_id BIGINT REFERENCES donations.funding_projects(id) ON DELETE SET NULL,

  -- Portal access (magic link for guest management)
  portal_access_token VARCHAR(255) UNIQUE,
  portal_access_expires_at TIMESTAMP,

  -- Stripe period tracking
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,

  -- Lifecycle timestamps
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT subscriptions_status_valid CHECK (
    status IN ('active', 'past_due', 'canceled', 'unpaid', 'paused', 'trialing', 'incomplete')
  ),
  CONSTRAINT subscriptions_amount_positive CHECK (amount > 0),
  CONSTRAINT subscriptions_interval_valid CHECK (interval IN ('month', 'year'))
);

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
ON donations.subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
ON donations.subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_donor_email
ON donations.subscriptions(donor_email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_portal_token
ON donations.subscriptions(portal_access_token)
WHERE portal_access_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
ON donations.subscriptions(status)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
ON donations.subscriptions(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_project_id
ON donations.subscriptions(project_id);

-- Auto-update timestamp trigger for subscriptions
CREATE OR REPLACE FUNCTION donations.update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON donations.subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
BEFORE UPDATE ON donations.subscriptions
FOR EACH ROW EXECUTE FUNCTION donations.update_subscriptions_updated_at();

-- Comments
COMMENT ON TABLE donations.subscriptions IS 'Tracks active and historical recurring donation subscriptions';
COMMENT ON COLUMN donations.subscriptions.stripe_subscription_id IS 'Unique Stripe subscription identifier';
COMMENT ON COLUMN donations.subscriptions.stripe_customer_id IS 'Stripe customer ID for portal access';
COMMENT ON COLUMN donations.subscriptions.user_id IS 'NULL for guest subscriptions (email-only)';
COMMENT ON COLUMN donations.subscriptions.portal_access_token IS 'Magic link token for guest subscription management (24hr expiry)';
COMMENT ON COLUMN donations.subscriptions.current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN donations.subscriptions.current_period_end IS 'End of current billing period (next charge date)';

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify migration success)
-- ============================================================================

-- Verify constraint updated:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'donations_processor_valid';

-- Verify new columns added:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'donations' AND table_name = 'donations' AND column_name IN ('stripe_subscription_id', 'stripe_customer_id', 'is_recurring', 'subscription_status');

-- Verify subscriptions table created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'donations' AND table_name = 'subscriptions';

-- Verify indexes created:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'donations' AND tablename = 'subscriptions';
