-- Add Team Categories Support to Journal System
-- Date: February 11, 2026
-- Purpose: Enable team-wide shared categories for collaborative journals

-- Add team category flag to journal_categories table
ALTER TABLE wiki.journal_categories
  ADD COLUMN IF NOT EXISTS is_team_category BOOLEAN DEFAULT FALSE;

-- Add index for performance when filtering team categories
CREATE INDEX IF NOT EXISTS idx_journal_categories_team
  ON wiki.journal_categories(is_team_category);

-- Optional: Convert existing categories to team categories
-- Uncomment the following line if you want all existing categories to become team-wide:
-- UPDATE wiki.journal_categories SET is_team_category = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN wiki.journal_categories.is_team_category IS 'TRUE for team-wide categories visible to all users, FALSE for personal user categories';
COMMENT ON INDEX wiki.idx_journal_categories_team IS 'Performance index for filtering team vs personal categories';
