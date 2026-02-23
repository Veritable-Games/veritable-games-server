-- Migration: Create Badge System Tables
-- Part of Phase 2: Badge Foundation
--
-- Run on PostgreSQL database (192.168.1.15) in the users schema
-- Command: docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/this/file.sql

-- Set search path to users schema
SET search_path TO users;

-- Badge definitions table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(100),                          -- Icon name or URL
  color VARCHAR(7) DEFAULT '#3b82f6',         -- Hex color for display
  badge_type VARCHAR(20) NOT NULL,            -- 'supporter', 'achievement', 'special'
  tier_level INTEGER DEFAULT 0,               -- For sorting within type (higher = better)
  min_donation_amount DECIMAL(10,2),          -- Minimum cumulative donation for supporter badges
  is_stackable BOOLEAN DEFAULT FALSE,         -- Can user have multiple of this badge?
  display_priority INTEGER DEFAULT 0,         -- Order for display (higher = first)
  is_active BOOLEAN DEFAULT TRUE,             -- Can this badge be granted?
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User-badge assignments table
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = automatic grant
  expires_at TIMESTAMP,                       -- NULL = never expires
  quantity INTEGER DEFAULT 1,                 -- For stackable badges
  is_displayed BOOLEAN DEFAULT TRUE,          -- User can hide badges
  notes TEXT,                                 -- Admin notes about grant
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_id)                   -- One badge type per user (unless stackable)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_badges_type ON badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_active ON badges(is_active);
CREATE INDEX IF NOT EXISTS idx_badges_tier ON badges(badge_type, tier_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_displayed ON user_badges(user_id, is_displayed);
CREATE INDEX IF NOT EXISTS idx_user_badges_granted ON user_badges(granted_at DESC);

-- Seed initial supporter badges (Space/Exploration theme)
INSERT INTO badges (slug, name, description, icon, color, badge_type, tier_level, min_donation_amount, display_priority, is_active)
VALUES
  ('pioneer', 'Pioneer', 'First step into the stars', 'rocket', '#cd7f32', 'supporter', 1, 5.00, 10, true),
  ('navigator', 'Navigator', 'Charting new paths', 'compass', '#c0c0c0', 'supporter', 2, 25.00, 20, true),
  ('voyager', 'Voyager', 'Seasoned explorer', 'globe', '#ffd700', 'supporter', 3, 100.00, 30, true),
  ('commander', 'Commander', 'Leading the expedition', 'star', '#e5e4e2', 'supporter', 4, 500.00, 40, true),
  ('admiral', 'Admiral', 'Legendary contributor', 'crown', '#b9f2ff', 'supporter', 5, 1000.00, 50, true)
ON CONFLICT (slug) DO NOTHING;

-- Add some special badges
INSERT INTO badges (slug, name, description, icon, color, badge_type, tier_level, display_priority, is_active)
VALUES
  ('founder', 'Founder', 'Original community founder', 'shield', '#9333ea', 'special', 100, 100, true),
  ('early-adopter', 'Early Adopter', 'Joined during the early days', 'clock', '#0ea5e9', 'special', 50, 60, true),
  ('contributor', 'Contributor', 'Made significant contributions to the project', 'code', '#22c55e', 'special', 30, 55, true)
ON CONFLICT (slug) DO NOTHING;

-- Verify tables were created
SELECT 'badges' as table_name, COUNT(*) as row_count FROM badges
UNION ALL
SELECT 'user_badges', COUNT(*) FROM user_badges;
