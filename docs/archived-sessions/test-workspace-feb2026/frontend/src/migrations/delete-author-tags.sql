-- Delete all "author: X" tags from the unified tags system
-- These are redundant since documents already have author fields
-- CASCADE will automatically delete document associations

BEGIN;

-- Show statistics before deletion
SELECT 
  COUNT(*) as tags_to_delete,
  (SELECT COUNT(*) FROM library.library_document_tags ldt 
   WHERE ldt.tag_id IN (SELECT id FROM shared.tags WHERE name LIKE 'author:%')) as library_associations,
  (SELECT COUNT(*) FROM anarchist.document_tags adt 
   WHERE adt.tag_id IN (SELECT id FROM shared.tags WHERE name LIKE 'author:%')) as anarchist_associations;

-- Delete all author: tags (CASCADE will handle associations)
DELETE FROM shared.tags WHERE name LIKE 'author:%';

COMMIT;

-- Show results
SELECT 
  'Deletion complete' as status,
  COUNT(*) as remaining_tags 
FROM shared.tags;
