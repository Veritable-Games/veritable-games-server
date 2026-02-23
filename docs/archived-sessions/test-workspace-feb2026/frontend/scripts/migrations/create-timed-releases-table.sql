-- Migration: Create Timed Releases Table
-- Part of Phase 5: Supporter Early Access System
--
-- Run on PostgreSQL database (192.168.1.15) in the content schema
-- Command: docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/this/file.sql

-- Set search path to content schema
SET search_path TO content;

-- Timed releases table
-- Controls early access for supporters to content before public release
CREATE TABLE IF NOT EXISTS timed_releases (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,           -- 'topic', 'news', 'project_update'
  entity_id INTEGER NOT NULL,                  -- ID of the entity in its respective table
  early_access_days INTEGER DEFAULT 3,         -- Days supporters get early access
  supporter_release_at TIMESTAMP NOT NULL,     -- When supporters can access
  public_release_at TIMESTAMP NOT NULL,        -- When public can access
  min_supporter_tier VARCHAR(50) DEFAULT 'pioneer',  -- Minimum badge tier for early access
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,                          -- Admin who created the timed release
  UNIQUE(entity_type, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timed_releases_entity ON timed_releases(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_timed_releases_supporter_release ON timed_releases(supporter_release_at);
CREATE INDEX IF NOT EXISTS idx_timed_releases_public_release ON timed_releases(public_release_at);

-- Comments for documentation
COMMENT ON TABLE timed_releases IS 'Controls early access for supporters to content before public release';
COMMENT ON COLUMN timed_releases.entity_type IS 'Type of content: topic (forum), news, project_update';
COMMENT ON COLUMN timed_releases.entity_id IS 'ID of the entity in its respective table';
COMMENT ON COLUMN timed_releases.early_access_days IS 'Number of days supporters get early access before public release';
COMMENT ON COLUMN timed_releases.supporter_release_at IS 'Timestamp when supporters can start accessing the content';
COMMENT ON COLUMN timed_releases.public_release_at IS 'Timestamp when content becomes publicly available';
COMMENT ON COLUMN timed_releases.min_supporter_tier IS 'Minimum supporter badge tier required for early access (pioneer/navigator/voyager/commander/admiral)';

-- Verify table creation
SELECT 'timed_releases' as table_name, COUNT(*) as row_count FROM timed_releases;
