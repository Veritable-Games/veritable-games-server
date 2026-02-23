-- Invitation System for Controlled Registration
-- Created: 2025-10-28
-- Purpose: Token-based invitation system for admin-controlled user registration

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Invitation token (unique, secure)
  token TEXT NOT NULL UNIQUE,

  -- Who created this invitation
  created_by INTEGER NOT NULL,

  -- Optional: Email this invitation is for (if specified, only this email can use it)
  email TEXT,

  -- Invitation metadata
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL, -- Invitations expire after a set time

  -- Usage tracking
  used_at DATETIME, -- NULL if not yet used
  used_by INTEGER, -- User ID who used this invitation (NULL if not used)

  -- Status tracking
  is_revoked INTEGER NOT NULL DEFAULT 0, -- 0 = active, 1 = revoked by admin
  revoked_at DATETIME,
  revoked_by INTEGER,

  -- Optional metadata
  notes TEXT, -- Admin notes about this invitation
  max_uses INTEGER NOT NULL DEFAULT 1, -- How many times can this token be used (usually 1)
  use_count INTEGER NOT NULL DEFAULT 0, -- How many times has it been used

  -- Foreign keys
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_created_by ON invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON invitations(used_at);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_is_revoked ON invitations(is_revoked);

-- Composite index for active invitations lookup
CREATE INDEX IF NOT EXISTS idx_invitations_active ON invitations(token, is_revoked, expires_at)
  WHERE is_revoked = 0 AND used_at IS NULL;
