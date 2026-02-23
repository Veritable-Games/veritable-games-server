-- Create banned_emails table for permanent email blacklist
-- Prevents hard-banned users from re-registering with same email
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS users.banned_emails (
  email VARCHAR(255) PRIMARY KEY,
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  banned_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for quick lookup during registration
CREATE INDEX IF NOT EXISTS idx_banned_emails_email ON users.banned_emails(email);

-- Index for admin queries by date
CREATE INDEX IF NOT EXISTS idx_banned_emails_banned_at ON users.banned_emails(banned_at DESC);

-- Comment for documentation
COMMENT ON TABLE users.banned_emails IS 'Email addresses permanently banned from registration';
COMMENT ON COLUMN users.banned_emails.email IS 'Email address that is banned';
COMMENT ON COLUMN users.banned_emails.banned_at IS 'When the email was banned';
COMMENT ON COLUMN users.banned_emails.banned_by IS 'Admin user who banned this email';
COMMENT ON COLUMN users.banned_emails.reason IS 'Reason for banning (e.g., hard ban, spam, abuse)';
COMMENT ON COLUMN users.banned_emails.notes IS 'Additional notes about the ban';
