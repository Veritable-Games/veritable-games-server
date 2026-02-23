-- Migration: 009-journal-categories.sql
-- Purpose: Create separate category system for journals (independent from wiki categories)
-- Date: 2025-12-24

-- ============================================================================
-- JOURNAL CATEGORIES TABLE
-- ============================================================================
-- Per-user category system for organizing journal entries
-- Completely separate from wiki.wiki_categories

CREATE TABLE IF NOT EXISTS wiki.journal_categories (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each user can only have one category with a given name
  CONSTRAINT journal_categories_user_name_unique UNIQUE (user_id, name)
);

-- Index for fast user-specific lookups
CREATE INDEX IF NOT EXISTS idx_journal_categories_user
ON wiki.journal_categories(user_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_journal_categories_sort
ON wiki.journal_categories(user_id, sort_order);

-- ============================================================================
-- ADD JOURNAL CATEGORY REFERENCE TO WIKI_PAGES
-- ============================================================================
-- This column links journal entries to their journal-specific category
-- Separate from the existing category_id which links to wiki categories

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'wiki'
    AND table_name = 'wiki_pages'
    AND column_name = 'journal_category_id'
  ) THEN
    ALTER TABLE wiki.wiki_pages
    ADD COLUMN journal_category_id TEXT REFERENCES wiki.journal_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast category-based journal queries
CREATE INDEX IF NOT EXISTS idx_wiki_pages_journal_category
ON wiki.wiki_pages(journal_category_id)
WHERE namespace = 'journals';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE wiki.journal_categories IS
'Per-user categories for organizing journal entries. Separate from wiki categories.';

COMMENT ON COLUMN wiki.journal_categories.id IS
'Unique category ID (format: jcat-{userId}-{timestamp}-{random})';

COMMENT ON COLUMN wiki.journal_categories.user_id IS
'Owner of this category - each user has their own category list';

COMMENT ON COLUMN wiki.journal_categories.name IS
'Display name of the category (e.g., "Uncategorized", "Work Notes", "Ideas")';

COMMENT ON COLUMN wiki.journal_categories.sort_order IS
'Display order in sidebar (lower numbers appear first)';

COMMENT ON COLUMN wiki.wiki_pages.journal_category_id IS
'For journal entries only: links to journal_categories.id. NULL for non-journal pages.';
