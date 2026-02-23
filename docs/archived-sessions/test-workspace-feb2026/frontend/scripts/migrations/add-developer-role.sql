-- Migration: Add 'developer' role to users table
-- This migration updates the role constraint to include the new 'developer' role
-- Hierarchy: user (0) → moderator (1) → developer (2) → admin (3)
--
-- Run this on production PostgreSQL database (192.168.1.15)
--
-- IMPORTANT: Run on the users schema which contains the users table

-- Drop existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with 'developer' role
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'moderator', 'developer', 'admin'));

-- Verify the constraint was added
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check';
