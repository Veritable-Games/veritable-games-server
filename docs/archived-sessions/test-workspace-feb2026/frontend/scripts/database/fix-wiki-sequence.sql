-- Fix wiki_pages sequence that's out of sync
-- This resets the sequence to the correct value based on existing data

-- Reset wiki_pages sequence
SELECT setval('wiki.wiki_pages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.wiki_pages));

-- Also fix wiki_revisions sequence if needed
SELECT setval('wiki.wiki_revisions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.wiki_revisions));

-- Show the new sequence values
SELECT 'wiki_pages next ID will be: ' || nextval('wiki.wiki_pages_id_seq');
SELECT 'wiki_revisions next ID will be: ' || nextval('wiki.wiki_revisions_id_seq');
