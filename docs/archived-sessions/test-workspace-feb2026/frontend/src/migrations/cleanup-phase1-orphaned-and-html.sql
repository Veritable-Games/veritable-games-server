-- Phase 1: Tag Cleanup - Orphaned Tags and HTML Markup
-- Safe cleanup with zero risk (no document associations)

BEGIN;

-- Show statistics before deletion
SELECT 
  'Before Phase 1' as phase,
  COUNT(*) as total_tags,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM library.library_document_tags ldt WHERE ldt.tag_id = t.id
  ) AND NOT EXISTS (
    SELECT 1 FROM anarchist.document_tags adt WHERE adt.tag_id = t.id
  )) as orphaned_tags
FROM shared.tags t;

-- 1.1: Delete orphaned tags (38 total)
DELETE FROM shared.tags 
WHERE id IN (
  20, 1, 9, 8, 13, 5, 16, 11, 31, 37, 2, 29, 35, 19, 4, 14, 32, 12, 
  18, 15, 6, 7, 36, 41, 17, 3, 44, 10, 38694, 38937, 2819, 23, 
  39934, 21, 38938, 39829, 22, 59
);

-- 1.2: Fix HTML markup tags
-- First, ensure clean versions exist (create if needed)
INSERT INTO shared.tags (name, description)
VALUES 
  ('21st century', 'Documents from or about the 21st century'),
  ('19th century', 'Documents from or about the 19th century'),
  ('20th century', 'Documents from or about the 20th century'),
  ('20th century anarchism', 'Anarchist movements and theory in the 20th century'),
  ('19th century anarchism', 'Anarchist movements and theory in the 19th century'),
  ('march 8th', 'International Women''s Day'),
  ('workers''', 'Related to workers and labor')
ON CONFLICT (name) DO NOTHING;

-- Get IDs for the merge operations
DO $$
DECLARE
  clean_21st_id INT;
  clean_19th_id INT;
  clean_20th_id INT;
  clean_20th_anarchism_id INT;
  clean_19th_anarchism_id INT;
  clean_march8_id INT;
  clean_workers_id INT;
  
  dirty_21st_id INT;
  dirty_19th_id INT;
  dirty_20th_id INT;
  dirty_20th_anarchism_id INT;
  dirty_19th_anarchism_id INT;
  dirty_march8_id INT;
  dirty_workers_id INT;
BEGIN
  -- Get clean IDs
  SELECT id INTO clean_21st_id FROM shared.tags WHERE name = '21st century';
  SELECT id INTO clean_19th_id FROM shared.tags WHERE name = '19th century';
  SELECT id INTO clean_20th_id FROM shared.tags WHERE name = '20th century';
  SELECT id INTO clean_20th_anarchism_id FROM shared.tags WHERE name = '20th century anarchism';
  SELECT id INTO clean_19th_anarchism_id FROM shared.tags WHERE name = '19th century anarchism';
  SELECT id INTO clean_march8_id FROM shared.tags WHERE name = 'march 8th';
  SELECT id INTO clean_workers_id FROM shared.tags WHERE name = 'workers''';
  
  -- Get dirty IDs
  SELECT id INTO dirty_21st_id FROM shared.tags WHERE name = '21<sup>st</sup> century';
  SELECT id INTO dirty_19th_id FROM shared.tags WHERE name = '19<sup>th</sup> century';
  SELECT id INTO dirty_20th_id FROM shared.tags WHERE name = '20<sup>th</sup> century';
  SELECT id INTO dirty_20th_anarchism_id FROM shared.tags WHERE name = '20<sup>th</sup> century anarchism';
  SELECT id INTO dirty_19th_anarchism_id FROM shared.tags WHERE name = '19<sup>th</sup> century anarchism';
  SELECT id INTO dirty_march8_id FROM shared.tags WHERE name = 'march 8<sup>th</sup>';
  SELECT id INTO dirty_workers_id FROM shared.tags WHERE name = 'workers&#39';
  
  -- Migrate library documents
  IF dirty_21st_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_21st_id WHERE tag_id = dirty_21st_id;
  END IF;
  IF dirty_19th_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_19th_id WHERE tag_id = dirty_19th_id;
  END IF;
  IF dirty_20th_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_20th_id WHERE tag_id = dirty_20th_id;
  END IF;
  IF dirty_20th_anarchism_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_20th_anarchism_id WHERE tag_id = dirty_20th_anarchism_id;
  END IF;
  IF dirty_19th_anarchism_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_19th_anarchism_id WHERE tag_id = dirty_19th_anarchism_id;
  END IF;
  IF dirty_march8_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_march8_id WHERE tag_id = dirty_march8_id;
  END IF;
  IF dirty_workers_id IS NOT NULL THEN
    UPDATE library.library_document_tags SET tag_id = clean_workers_id WHERE tag_id = dirty_workers_id;
  END IF;
  
  -- Migrate anarchist documents
  IF dirty_21st_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_21st_id WHERE tag_id = dirty_21st_id;
  END IF;
  IF dirty_19th_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_19th_id WHERE tag_id = dirty_19th_id;
  END IF;
  IF dirty_20th_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_20th_id WHERE tag_id = dirty_20th_id;
  END IF;
  IF dirty_20th_anarchism_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_20th_anarchism_id WHERE tag_id = dirty_20th_anarchism_id;
  END IF;
  IF dirty_19th_anarchism_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_19th_anarchism_id WHERE tag_id = dirty_19th_anarchism_id;
  END IF;
  IF dirty_march8_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_march8_id WHERE tag_id = dirty_march8_id;
  END IF;
  IF dirty_workers_id IS NOT NULL THEN
    UPDATE anarchist.document_tags SET tag_id = clean_workers_id WHERE tag_id = dirty_workers_id;
  END IF;
END $$;

-- Delete the dirty HTML tags
DELETE FROM shared.tags WHERE name LIKE '%<sup>%' OR name LIKE '%&#%';

-- Show results
SELECT 
  'After Phase 1' as phase,
  COUNT(*) as total_tags,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM library.library_document_tags ldt WHERE ldt.tag_id = t.id
  ) AND NOT EXISTS (
    SELECT 1 FROM anarchist.document_tags adt WHERE adt.tag_id = t.id
  )) as orphaned_tags
FROM shared.tags t;

COMMIT;
