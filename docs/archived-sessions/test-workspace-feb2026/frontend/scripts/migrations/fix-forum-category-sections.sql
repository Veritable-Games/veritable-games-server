-- Migration: Fix Forum Category Section References
-- Date: 2025-11-10
-- Issue: forum_categories.section column contained display names instead of section IDs
--
-- Problem: Production forums showed only "Dodec" section because other categories
-- referenced section display names ("Social Contract", "Noxii Game", etc.) instead
-- of section IDs ("general", "games", etc.)
--
-- This caused categories to not match their parent sections, making them invisible.
--
-- Root Cause: Data migration from SQLite to PostgreSQL incorrectly populated
-- the section column with human-readable names instead of foreign key IDs.

BEGIN;

-- Update forum categories to reference section IDs instead of display names
UPDATE forums.forum_categories
SET section = 'general'
WHERE section = 'Social Contract';

UPDATE forums.forum_categories
SET section = 'games'
WHERE section = 'Noxii Game';

UPDATE forums.forum_categories
SET section = 'autumn'
WHERE section = 'Autumn Project';

UPDATE forums.forum_categories
SET section = 'misc'
WHERE section = 'Miscellaneous';

-- Verify the fix: all categories should now reference valid section IDs
-- Expected output: 7 categories across 5 sections (general, games, autumn, dodec, misc)
SELECT
  s.id AS section_id,
  s.display_name AS section_name,
  COUNT(c.id) AS category_count,
  array_agg(c.name ORDER BY c.sort_order) AS categories
FROM forums.forum_sections s
LEFT JOIN forums.forum_categories c ON c.section = s.id
GROUP BY s.id, s.display_name, s.sort_order
ORDER BY s.sort_order;

COMMIT;

-- Expected result after migration:
-- section_id | section_name              | category_count | categories
-- -----------|---------------------------|----------------|----------------------------------
-- general    | Social Contract           | 1              | {Forum Rules}
-- games      | NOXII                     | 3              | {Noxii General Discussion, Noxii Modding, Maps & Mods}
-- autumn     | AUTUMN: Now is the Season | 1              | {Autumn Development}
-- dodec      | DODEC: Beyond Our Home    | 1              | {Dodec General Discussion}
-- misc       | Miscellaneous             | 1              | {Off-Topic}
