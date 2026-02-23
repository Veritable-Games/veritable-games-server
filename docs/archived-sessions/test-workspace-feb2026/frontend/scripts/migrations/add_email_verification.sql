-- Email Verification Schema Migration
-- Adds email verification and preferences to users table
-- Created: November 2025

-- Add email verification columns to users table
ALTER TABLE users.users
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_message_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_reply_notifications BOOLEAN DEFAULT TRUE;

-- Create email logs table for audit trail
CREATE TABLE IF NOT EXISTS system.email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token 
ON users.users(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON system.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON system.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON system.email_logs(sent_at DESC);
