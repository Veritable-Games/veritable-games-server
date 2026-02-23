-- Migration: Create Category Access Table
-- Part of Phase 4: Forum Access Control
--
-- Run on PostgreSQL database (192.168.1.15) in the forums schema
-- Command: docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/this/file.sql

-- Set search path to forums schema
SET search_path TO forums;

-- Category access rules table
-- Controls who can view/post in specific forum categories
CREATE TABLE IF NOT EXISTS category_access (
  id SERIAL PRIMARY KEY,
  category_slug TEXT NOT NULL,                 -- References forum_categories.slug
  access_type VARCHAR(20) NOT NULL,            -- 'role', 'badge', 'badge_type'
  access_value VARCHAR(100) NOT NULL,          -- Role name, badge slug, or badge type
  permission_level VARCHAR(20) DEFAULT 'view', -- 'view', 'post', 'moderate'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_slug, access_type, access_value, permission_level)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_access_slug ON category_access(category_slug);
CREATE INDEX IF NOT EXISTS idx_category_access_type ON category_access(access_type);
CREATE INDEX IF NOT EXISTS idx_category_access_value ON category_access(access_value);

-- Comments for documentation
COMMENT ON TABLE category_access IS 'Controls access restrictions for forum categories';
COMMENT ON COLUMN category_access.access_type IS 'Type of access rule: role (user role), badge (specific badge), badge_type (any badge of type)';
COMMENT ON COLUMN category_access.access_value IS 'The role name (admin/moderator/developer), badge slug (pioneer/admiral), or badge type (supporter)';
COMMENT ON COLUMN category_access.permission_level IS 'Level of access granted: view (read-only), post (can create topics/replies), moderate (full control)';

-- Create the Supporters Lounge category if it doesn't exist
INSERT INTO forum_categories (slug, name, description, color, icon, section, sort_order, is_public)
VALUES (
  'supporters-lounge',
  'Supporters Lounge',
  'Exclusive discussion area for supporters. Thank you for your contributions!',
  '#ffd700',  -- Gold color for supporters
  'crown',
  'community',
  100,  -- High sort order
  false  -- Not public - requires access check
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_public = EXCLUDED.is_public;

-- Add access restriction for Supporters Lounge
-- Only users with any supporter badge can view and post
INSERT INTO category_access (category_slug, access_type, access_value, permission_level)
VALUES
  ('supporters-lounge', 'badge_type', 'supporter', 'view'),
  ('supporters-lounge', 'badge_type', 'supporter', 'post')
ON CONFLICT (category_slug, access_type, access_value, permission_level) DO NOTHING;

-- Allow admins full access to Supporters Lounge
INSERT INTO category_access (category_slug, access_type, access_value, permission_level)
VALUES
  ('supporters-lounge', 'role', 'admin', 'view'),
  ('supporters-lounge', 'role', 'admin', 'post'),
  ('supporters-lounge', 'role', 'admin', 'moderate')
ON CONFLICT (category_slug, access_type, access_value, permission_level) DO NOTHING;

-- Allow moderators view and moderate access
INSERT INTO category_access (category_slug, access_type, access_value, permission_level)
VALUES
  ('supporters-lounge', 'role', 'moderator', 'view'),
  ('supporters-lounge', 'role', 'moderator', 'moderate')
ON CONFLICT (category_slug, access_type, access_value, permission_level) DO NOTHING;

-- Verify tables
SELECT 'category_access' as table_name, COUNT(*) as row_count FROM category_access
UNION ALL
SELECT 'supporters-lounge category', COUNT(*) FROM forum_categories WHERE slug = 'supporters-lounge';
