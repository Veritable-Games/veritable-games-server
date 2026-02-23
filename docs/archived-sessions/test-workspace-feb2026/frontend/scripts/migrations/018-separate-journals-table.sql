-- Migration 018: Separate Journals Table
-- Date: February 15, 2026
-- Purpose: Migrate journals from wiki_pages to dedicated journals table

-- ============================================================
-- PHASE 1: Create journals table
-- ============================================================

CREATE TABLE IF NOT EXISTS wiki.journals (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Core Fields
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',

  -- Journal-Specific
  category_id TEXT REFERENCES wiki.journal_categories(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  restored_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
  restored_at TIMESTAMP,

  -- Constraints
  CONSTRAINT journals_unique_slug UNIQUE (user_id, slug)
  -- Note: Category ownership validation handled at application level
  -- Cannot use subquery in CHECK constraint in PostgreSQL
);

-- ============================================================
-- PHASE 2: Create indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_journals_user_id ON wiki.journals(user_id);
CREATE INDEX IF NOT EXISTS idx_journals_slug ON wiki.journals(slug);
CREATE INDEX IF NOT EXISTS idx_journals_category_id ON wiki.journals(category_id);
CREATE INDEX IF NOT EXISTS idx_journals_deleted ON wiki.journals(is_deleted, user_id);
CREATE INDEX IF NOT EXISTS idx_journals_created_at ON wiki.journals(created_at DESC);

-- ============================================================
-- PHASE 3: Add index to wiki_revisions for journal queries
-- ============================================================

-- wiki_revisions will continue to store both wiki and journal revisions
-- Revisions are identified by page_id alone (no namespace column)
-- Add index to help with revision queries by page_id
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_page_id ON wiki.wiki_revisions(page_id);

-- ============================================================
-- PHASE 4: Clean up deprecated archive columns from wiki_pages
-- ============================================================

-- Archive functionality was removed in previous update
-- Clean up old columns if they exist
ALTER TABLE wiki.wiki_pages DROP COLUMN IF EXISTS is_archived;
ALTER TABLE wiki.wiki_pages DROP COLUMN IF EXISTS archived_by;
ALTER TABLE wiki.wiki_pages DROP COLUMN IF EXISTS archived_at;

-- ============================================================
-- VERIFICATION QUERIES (for manual verification)
-- ============================================================

-- Uncomment to verify table creation:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'wiki' AND table_name = 'journals';

-- Uncomment to verify indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'journals';

-- Uncomment to check journal count before migration:
-- SELECT COUNT(*) as journal_count FROM wiki_pages WHERE namespace = 'journals';
