-- ============================================================================
-- UNIFIED TAG SCHEMA MIGRATION
-- Date: 2025-11-11
-- Purpose: Consolidate library.library_tags and anarchist.tags into shared.tags
-- Author: Claude Code
--
-- This migration creates a unified tag system that serves both the User Library
-- and Anarchist Library collections, enabling cross-collection tag browsing
-- and eliminating duplicate tag management.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE SHARED SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS shared;

GRANT USAGE ON SCHEMA shared TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA shared TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA shared TO postgres;

-- ============================================================================
-- PHASE 2: CREATE SHARED.TAGS TABLE
-- ============================================================================

CREATE TABLE shared.tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_shared_tags_name ON shared.tags(name);
CREATE INDEX idx_shared_tags_usage_count ON shared.tags(usage_count DESC);

-- Enable pg_trgm for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_shared_tags_name_trgm ON shared.tags USING gin (name gin_trgm_ops);

-- ============================================================================
-- PHASE 3: CREATE TRIGGER FUNCTION FOR AUTOMATIC USAGE COUNT MAINTENANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION shared.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared.tags
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared.tags
        SET usage_count = GREATEST(0, usage_count - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 4: MIGRATE LIBRARY TAGS TO SHARED.TAGS
-- ============================================================================

-- Insert library tags preserving IDs for compatibility
INSERT INTO shared.tags (id, name, description, usage_count, created_at)
SELECT
    id,
    name,
    description,
    usage_count,
    created_at
FROM library.library_tags
ORDER BY id;

-- Update sequence to prevent ID conflicts
SELECT setval('shared.tags_id_seq', (SELECT MAX(id) FROM shared.tags));

-- ============================================================================
-- PHASE 5: UPDATE LIBRARY.LIBRARY_DOCUMENT_TAGS
-- ============================================================================

-- Drop old foreign key
ALTER TABLE library.library_document_tags
    DROP CONSTRAINT IF EXISTS library_document_tags_tag_id_fkey;

-- Add new foreign key to shared.tags
ALTER TABLE library.library_document_tags
    ADD CONSTRAINT library_document_tags_tag_id_fkey
        FOREIGN KEY (tag_id) REFERENCES shared.tags(id) ON DELETE CASCADE;

-- Remove user tracking columns (simplified schema)
DROP INDEX IF EXISTS library.idx_library_document_tags_user;
ALTER TABLE library.library_document_tags
    DROP COLUMN IF EXISTS added_by,
    DROP COLUMN IF EXISTS added_at;

-- ============================================================================
-- PHASE 6: UPDATE ANARCHIST.DOCUMENT_TAGS
-- ============================================================================

-- Drop old foreign key if it exists
ALTER TABLE anarchist.document_tags
    DROP CONSTRAINT IF EXISTS document_tags_tag_id_fkey;

-- Add new foreign key to shared.tags
ALTER TABLE anarchist.document_tags
    ADD CONSTRAINT document_tags_tag_id_fkey
        FOREIGN KEY (tag_id) REFERENCES shared.tags(id) ON DELETE CASCADE;

-- ============================================================================
-- PHASE 7: INSTALL TRIGGERS ON JUNCTION TABLES
-- ============================================================================

-- Trigger on library.library_document_tags
DROP TRIGGER IF EXISTS library_document_tags_usage_trigger ON library.library_document_tags;
CREATE TRIGGER library_document_tags_usage_trigger
AFTER INSERT OR DELETE ON library.library_document_tags
FOR EACH ROW
EXECUTE FUNCTION shared.update_tag_usage_count();

-- Trigger on anarchist.document_tags
DROP TRIGGER IF EXISTS anarchist_document_tags_usage_trigger ON anarchist.document_tags;
CREATE TRIGGER anarchist_document_tags_usage_trigger
AFTER INSERT OR DELETE ON anarchist.document_tags
FOR EACH ROW
EXECUTE FUNCTION shared.update_tag_usage_count();

-- ============================================================================
-- PHASE 8: RECALCULATE USAGE COUNTS
-- ============================================================================

-- Reset all usage counts to 0
UPDATE shared.tags SET usage_count = 0;

-- Recalculate from library documents
UPDATE shared.tags t
SET usage_count = COALESCE(
    (SELECT COUNT(*)
     FROM library.library_document_tags dt
     WHERE dt.tag_id = t.id), 0
);

-- Add anarchist document counts (should be 0 until import runs)
UPDATE shared.tags t
SET usage_count = usage_count + COALESCE(
    (SELECT COUNT(*)
     FROM anarchist.document_tags dt
     WHERE dt.tag_id = t.id), 0
);

-- ============================================================================
-- PHASE 9: MARK OLD TABLES AS DEPRECATED (KEEP FOR ROLLBACK)
-- ============================================================================

COMMENT ON TABLE library.library_tags IS 'DEPRECATED: Migrated to shared.tags on 2025-11-11. Safe to drop after 2025-12-11 if no issues.';
COMMENT ON TABLE library.library_tag_categories IS 'DEPRECATED: Categories eliminated in unified schema. Safe to drop after 2025-12-11 if no issues.';

-- Do NOT drop anarchist.tags yet - it was never populated, just mark as deprecated
COMMENT ON TABLE anarchist.tags IS 'DEPRECATED: Never populated. Using shared.tags instead. Safe to drop immediately.';

-- ============================================================================
-- PHASE 10: VALIDATION
-- ============================================================================

-- Validation 1: Check tag count matches
DO $$
DECLARE
    original_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM library.library_tags;
    SELECT COUNT(*) INTO new_count FROM shared.tags;

    IF original_count != new_count THEN
        RAISE EXCEPTION 'Tag count mismatch! Original: %, New: %', original_count, new_count;
    END IF;

    RAISE NOTICE '✓ Validation passed: % tags migrated successfully', new_count;
END $$;

-- Validation 2: Check all relationships valid
DO $$
DECLARE
    invalid_relationships INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_relationships
    FROM library.library_document_tags dt
    LEFT JOIN shared.tags t ON dt.tag_id = t.id
    WHERE t.id IS NULL;

    IF invalid_relationships > 0 THEN
        RAISE EXCEPTION 'Found % invalid tag relationships!', invalid_relationships;
    END IF;

    RAISE NOTICE '✓ Validation passed: All document-tag relationships valid';
END $$;

-- Validation 3: Check usage counts are accurate
DO $$
DECLARE
    count_mismatches INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_mismatches
    FROM shared.tags t
    WHERE t.usage_count != (
        SELECT COUNT(*) FROM library.library_document_tags WHERE tag_id = t.id
    );

    IF count_mismatches > 0 THEN
        RAISE WARNING 'Found % tags with usage count mismatches', count_mismatches;
    ELSE
        RAISE NOTICE '✓ Validation passed: All usage counts accurate';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE - SHOW SUMMARY
-- ============================================================================

SELECT
    'Migration complete!' as status,
    (SELECT COUNT(*) FROM shared.tags) as total_tags,
    (SELECT COUNT(*) FROM library.library_document_tags) as library_relationships,
    (SELECT COUNT(*) FROM anarchist.document_tags) as anarchist_relationships;

-- Show top 10 tags by usage
SELECT
    name,
    usage_count,
    description
FROM shared.tags
ORDER BY usage_count DESC
LIMIT 10;
