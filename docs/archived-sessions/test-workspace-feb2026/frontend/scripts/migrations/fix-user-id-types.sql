-- Migration: Fix User ID Column Types (TEXT → INTEGER)
-- Issue: User ID columns stored as TEXT in content schema but users.id is INTEGER
-- Impact: Cross-schema queries fail with type mismatch errors in PostgreSQL
-- Date: 2025-11-07

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

-- Verify no non-numeric values exist (should return 0 for all)
-- Note: Allows both integer ("1") and decimal ("1.0") formats
DO $$
DECLARE
  non_numeric_count INTEGER;
BEGIN
  -- Check project_reference_images.uploaded_by
  SELECT COUNT(*) INTO non_numeric_count
  FROM content.project_reference_images
  WHERE uploaded_by !~ '^[0-9]+(\.[0-9]+)?$';

  IF non_numeric_count > 0 THEN
    RAISE EXCEPTION 'Found % non-numeric values in project_reference_images.uploaded_by', non_numeric_count;
  END IF;

  -- Check project_reference_images.deleted_by
  SELECT COUNT(*) INTO non_numeric_count
  FROM content.project_reference_images
  WHERE deleted_by IS NOT NULL AND deleted_by !~ '^[0-9]+(\.[0-9]+)?$';

  IF non_numeric_count > 0 THEN
    RAISE EXCEPTION 'Found % non-numeric values in project_reference_images.deleted_by', non_numeric_count;
  END IF;

  -- Check reference_albums.created_by
  SELECT COUNT(*) INTO non_numeric_count
  FROM content.reference_albums
  WHERE created_by !~ '^[0-9]+(\.[0-9]+)?$';

  IF non_numeric_count > 0 THEN
    RAISE EXCEPTION 'Found % non-numeric values in reference_albums.created_by', non_numeric_count;
  END IF;

  RAISE NOTICE 'Safety check passed - all user ID values are numeric (integer or decimal format)';
END $$;

-- ============================================================================
-- MIGRATION
-- ============================================================================

BEGIN;

-- Create backup tables (for rollback if needed)
CREATE TABLE IF NOT EXISTS content.project_reference_images_backup AS
  SELECT * FROM content.project_reference_images;

CREATE TABLE IF NOT EXISTS content.reference_albums_backup AS
  SELECT * FROM content.reference_albums;

CREATE TABLE IF NOT EXISTS content.workspace_revisions_backup AS
  SELECT * FROM content.workspace_revisions;

CREATE TABLE IF NOT EXISTS content.workspaces_old_backup AS
  SELECT * FROM content.workspaces_old;

-- Fix project_reference_images table
-- Note: Using ::numeric::integer to handle both "1" and "1.0" formats
ALTER TABLE content.project_reference_images
  ALTER COLUMN uploaded_by TYPE INTEGER
  USING uploaded_by::numeric::integer;

ALTER TABLE content.project_reference_images
  ALTER COLUMN deleted_by TYPE INTEGER
  USING CASE
    WHEN deleted_by IS NULL THEN NULL
    ELSE deleted_by::numeric::integer
  END;

-- Fix reference_albums table
ALTER TABLE content.reference_albums
  ALTER COLUMN created_by TYPE INTEGER
  USING created_by::numeric::integer;

-- Fix workspace_revisions table
ALTER TABLE content.workspace_revisions
  ALTER COLUMN created_by TYPE INTEGER
  USING created_by::numeric::integer;

-- Fix workspaces_old table (if it exists and has the column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'content'
    AND table_name = 'workspaces_old'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'content'
    AND table_name = 'workspaces_old'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE content.workspaces_old
      ALTER COLUMN created_by TYPE INTEGER
      USING created_by::numeric::integer;
    RAISE NOTICE 'Fixed workspaces_old.created_by';
  ELSE
    RAISE NOTICE 'Skipped workspaces_old (table or column does not exist)';
  END IF;
END $$;

-- Verify changes
DO $$
DECLARE
  uploaded_by_type TEXT;
  deleted_by_type TEXT;
  album_created_by_type TEXT;
  workspace_created_by_type TEXT;
BEGIN
  -- Check project_reference_images columns
  SELECT data_type INTO uploaded_by_type
  FROM information_schema.columns
  WHERE table_schema = 'content'
    AND table_name = 'project_reference_images'
    AND column_name = 'uploaded_by';

  SELECT data_type INTO deleted_by_type
  FROM information_schema.columns
  WHERE table_schema = 'content'
    AND table_name = 'project_reference_images'
    AND column_name = 'deleted_by';

  -- Check reference_albums column
  SELECT data_type INTO album_created_by_type
  FROM information_schema.columns
  WHERE table_schema = 'content'
    AND table_name = 'reference_albums'
    AND column_name = 'created_by';

  -- Check workspace_revisions column
  SELECT data_type INTO workspace_created_by_type
  FROM information_schema.columns
  WHERE table_schema = 'content'
    AND table_name = 'workspace_revisions'
    AND column_name = 'created_by';

  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  project_reference_images.uploaded_by: %', uploaded_by_type;
  RAISE NOTICE '  project_reference_images.deleted_by: %', deleted_by_type;
  RAISE NOTICE '  reference_albums.created_by: %', album_created_by_type;
  RAISE NOTICE '  workspace_revisions.created_by: %', workspace_created_by_type;

  IF uploaded_by_type != 'integer' OR
     deleted_by_type != 'integer' OR
     album_created_by_type != 'integer' OR
     workspace_created_by_type != 'integer' THEN
    RAISE EXCEPTION 'Migration verification failed - not all columns are INTEGER type';
  END IF;

  RAISE NOTICE 'Migration verification passed - all columns are now INTEGER';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- DROP TABLE content.project_reference_images;
-- ALTER TABLE content.project_reference_images_backup RENAME TO project_reference_images;
-- DROP TABLE content.reference_albums;
-- ALTER TABLE content.reference_albums_backup RENAME TO reference_albums;
-- DROP TABLE content.workspace_revisions;
-- ALTER TABLE content.workspace_revisions_backup RENAME TO workspace_revisions;
-- DROP TABLE content.workspaces_old;
-- ALTER TABLE content.workspaces_old_backup RENAME TO workspaces_old;
-- COMMIT;
--
-- Then drop backup tables:
-- DROP TABLE content.project_reference_images_backup;
-- DROP TABLE content.reference_albums_backup;
-- DROP TABLE content.workspace_revisions_backup;
-- DROP TABLE content.workspaces_old_backup;
