-- Migration 018: Add journal archive tracking
-- Date: 2026-02-13
-- Description: Add is_archived, archived_by, and archived_at columns to wiki_pages table for journal archiving

-- Add archive tracking columns to wiki_pages
ALTER TABLE wiki.wiki_pages
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Add index for archived journals queries
CREATE INDEX IF NOT EXISTS idx_wiki_pages_archived ON wiki.wiki_pages(is_archived) WHERE namespace = 'journals';

-- Create combined index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_wiki_pages_journal_status
  ON wiki.wiki_pages(namespace, is_deleted, is_archived)
  WHERE namespace = 'journals';
