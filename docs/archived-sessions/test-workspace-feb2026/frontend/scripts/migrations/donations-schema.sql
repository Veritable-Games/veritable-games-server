-- ============================================================================
-- DONATIONS SCHEMA - Veritable Games Funding System
-- ============================================================================
-- Purpose: Track donations/contributions to game projects
-- Created: 2025-01-19
-- Legal: LLC (for-profit) - NOT 501(c)(3), contributions non-tax-deductible
-- Fundable Projects: NOXII, AUTUMN, DODEC, ON COMMAND, COSMIC KNIGHTS (5 total)
-- ============================================================================

-- Create donations schema
CREATE SCHEMA IF NOT EXISTS donations;

-- Set search path for this migration
SET search_path TO donations, public;

-- ============================================================================
-- TABLE: funding_projects
-- Links to existing content.projects table
-- Tracks which projects are accepting funding and their current totals
-- ============================================================================
CREATE TABLE funding_projects (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL UNIQUE, -- References content.projects(id)
  slug VARCHAR(255) NOT NULL UNIQUE, -- Denormalized for quick lookups
  name VARCHAR(255) NOT NULL,        -- Denormalized for display
  description TEXT,
  color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color for UI
  target_amount DECIMAL(10, 2),       -- Overall funding target (optional)
  current_amount DECIMAL(10, 2) DEFAULT 0.00, -- Total raised so far
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,     -- Can receive donations?
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT funding_projects_target_positive CHECK (target_amount IS NULL OR target_amount >= 0),
  CONSTRAINT funding_projects_current_positive CHECK (current_amount >= 0)
);

-- Indexes
CREATE INDEX idx_funding_projects_project_id ON funding_projects(project_id);
CREATE INDEX idx_funding_projects_slug ON funding_projects(slug);
CREATE INDEX idx_funding_projects_active ON funding_projects(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_funding_projects_display_order ON funding_projects(display_order ASC);

-- Comments
COMMENT ON TABLE funding_projects IS 'Projects that can receive funding (links to content.projects)';
COMMENT ON COLUMN funding_projects.project_id IS 'Foreign key to content.projects(id)';
COMMENT ON COLUMN funding_projects.current_amount IS 'Total raised across all time (calculated)';

-- ============================================================================
-- TABLE: funding_goals
-- Time-bound funding campaigns with specific targets
-- ============================================================================
CREATE TABLE funding_goals (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES funding_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_amount DECIMAL(10, 2) NOT NULL,
  current_amount DECIMAL(10, 2) DEFAULT 0.00,
  start_date DATE NOT NULL,
  end_date DATE,                      -- NULL = ongoing
  is_active BOOLEAN DEFAULT TRUE,
  is_recurring BOOLEAN DEFAULT FALSE, -- Monthly/quarterly goals
  recurrence_period VARCHAR(50),      -- 'monthly', 'quarterly', 'yearly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT funding_goals_target_positive CHECK (target_amount > 0),
  CONSTRAINT funding_goals_current_positive CHECK (current_amount >= 0),
  CONSTRAINT funding_goals_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Indexes
CREATE INDEX idx_funding_goals_project_id ON funding_goals(project_id);
CREATE INDEX idx_funding_goals_active ON funding_goals(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_funding_goals_dates ON funding_goals(start_date, end_date);

-- Comments
COMMENT ON TABLE funding_goals IS 'Time-bound funding campaigns with specific targets';
COMMENT ON COLUMN funding_goals.end_date IS 'NULL means ongoing/no end date';

-- ============================================================================
-- TABLE: donations
-- Individual donation/contribution records
-- ============================================================================
CREATE TABLE donations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,                     -- NULL for anonymous, references users.users(id)
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment processor info
  payment_processor VARCHAR(50) NOT NULL, -- 'stripe', 'btcpay'
  payment_id VARCHAR(255) UNIQUE,     -- External payment ID
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'

  -- Donor info (for display)
  donor_name VARCHAR(255),            -- Can override username or be set for anonymous
  donor_email VARCHAR(255),           -- For receipt (not public)
  is_anonymous BOOLEAN DEFAULT FALSE, -- Hide from public donor list
  message TEXT,                       -- Optional message to team

  -- Metadata
  metadata JSONB,                     -- Payment processor specific data

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,             -- When payment confirmed

  -- Constraints
  CONSTRAINT donations_amount_positive CHECK (amount > 0),
  CONSTRAINT donations_processor_valid CHECK (payment_processor IN ('stripe', 'btcpay', 'other'))
);

-- Indexes
CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_payment_status ON donations(payment_status);
CREATE INDEX idx_donations_payment_processor ON donations(payment_processor);
CREATE INDEX idx_donations_payment_id ON donations(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX idx_donations_completed_at ON donations(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Comments
COMMENT ON TABLE donations IS 'Individual donation/contribution records';
COMMENT ON COLUMN donations.user_id IS 'NULL for anonymous donations';
COMMENT ON COLUMN donations.donor_email IS 'Private - used for receipts only';
COMMENT ON COLUMN donations.payment_status IS 'pending, completed, failed, or refunded';

-- ============================================================================
-- TABLE: donation_allocations
-- Multi-project allocation (split donations across multiple projects)
-- ============================================================================
CREATE TABLE donation_allocations (
  id BIGSERIAL PRIMARY KEY,
  donation_id BIGINT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES funding_projects(id) ON DELETE RESTRICT,
  amount DECIMAL(10, 2) NOT NULL,
  percentage DECIMAL(5, 2),           -- 0.00 to 100.00
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT donation_allocations_amount_positive CHECK (amount > 0),
  CONSTRAINT donation_allocations_percentage_valid CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

-- Indexes
CREATE INDEX idx_donation_allocations_donation_id ON donation_allocations(donation_id);
CREATE INDEX idx_donation_allocations_project_id ON donation_allocations(project_id);

-- Comments
COMMENT ON TABLE donation_allocations IS 'Split donations across multiple projects';
COMMENT ON COLUMN donation_allocations.percentage IS 'Percentage of total donation allocated to this project';

-- ============================================================================
-- TABLE: expense_categories
-- Categories for organizing expenses (Taxes, Assets, API, etc.)
-- ============================================================================
CREATE TABLE expense_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#64748b',
  icon VARCHAR(50),                   -- Icon name for UI (e.g., 'DollarSign', 'Server')
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_expense_categories_slug ON expense_categories(slug);
CREATE INDEX idx_expense_categories_active ON expense_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_expense_categories_display_order ON expense_categories(display_order ASC);

-- Comments
COMMENT ON TABLE expense_categories IS 'Categories for organizing expenses (Taxes, Assets, API, Infrastructure, Development)';

-- Pre-populate expense categories
INSERT INTO expense_categories (name, slug, description, color, icon, display_order) VALUES
('Taxes', 'taxes', 'Federal and state tax obligations', '#ef4444', 'Receipt', 1),
('Assets', 'assets', 'Hardware, software licenses, equipment', '#f59e0b', 'Package', 2),
('API Services', 'api-services', 'Claude Code, OpenAI, third-party APIs', '#3b82f6', 'Cpu', 3),
('Infrastructure', 'infrastructure', 'Server hosting, domain, CDN, databases', '#8b5cf6', 'Server', 4),
('Development', 'development', 'Contractor fees, design work, tools', '#10b981', 'Code', 5);

-- ============================================================================
-- TABLE: expenses
-- Expense tracking for transparency
-- ============================================================================
CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  project_id BIGINT REFERENCES funding_projects(id) ON DELETE SET NULL, -- Optional project link
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT NOT NULL,
  receipt_url VARCHAR(500),          -- Link to receipt/invoice (optional)
  expense_date DATE NOT NULL,        -- When expense occurred
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_period VARCHAR(50),     -- 'monthly', 'yearly'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT expenses_amount_positive CHECK (amount > 0)
);

-- Indexes
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = TRUE;

-- Comments
COMMENT ON TABLE expenses IS 'Expense tracking for financial transparency';
COMMENT ON COLUMN expenses.project_id IS 'Optional - link expense to specific project';
COMMENT ON COLUMN expenses.receipt_url IS 'Public or private URL to receipt/invoice';

-- ============================================================================
-- TABLE: monthly_summaries
-- Pre-calculated monthly financial summaries for performance
-- ============================================================================
CREATE TABLE monthly_summaries (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,             -- 1-12
  total_donations DECIMAL(10, 2) DEFAULT 0.00,
  total_expenses DECIMAL(10, 2) DEFAULT 0.00,
  net_amount DECIMAL(10, 2) DEFAULT 0.00,
  donation_count INTEGER DEFAULT 0,
  expense_count INTEGER DEFAULT 0,
  is_finalized BOOLEAN DEFAULT FALSE, -- Locked from changes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(year, month),
  CONSTRAINT monthly_summaries_month_valid CHECK (month >= 1 AND month <= 12),
  CONSTRAINT monthly_summaries_counts_positive CHECK (donation_count >= 0 AND expense_count >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_monthly_summaries_year_month ON monthly_summaries(year DESC, month DESC);
CREATE INDEX idx_monthly_summaries_year ON monthly_summaries(year DESC);

-- Comments
COMMENT ON TABLE monthly_summaries IS 'Pre-calculated monthly financial summaries for transparency dashboard performance';
COMMENT ON COLUMN monthly_summaries.is_finalized IS 'TRUE when month is closed and no more changes allowed';

-- ============================================================================
-- FUNCTIONS: Update Triggers
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_funding_projects_updated_at BEFORE UPDATE ON funding_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_goals_updated_at BEFORE UPDATE ON funding_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_summaries_updated_at BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANTS: Permissions
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA donations TO postgres;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA donations TO postgres;

-- Grant permissions on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA donations TO postgres;

-- ============================================================================
-- INITIAL DATA: Populate funding_projects from content.projects
-- ============================================================================

-- Insert 5 main game projects (exclude PROJECT COALESCE and frameworks)
INSERT INTO funding_projects (project_id, slug, name, description, color, display_order, is_active)
SELECT
  id,
  slug,
  title,
  description,
  color,
  display_order,
  TRUE as is_active
FROM content.projects
WHERE slug IN ('noxii', 'autumn', 'dodec', 'on-command', 'cosmic-knights')
ORDER BY display_order ASC;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View all funding projects
-- SELECT * FROM donations.funding_projects ORDER BY display_order;

-- View all expense categories
-- SELECT * FROM donations.expense_categories ORDER BY display_order;

-- Check donations schema structure
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'donations' ORDER BY table_name;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
