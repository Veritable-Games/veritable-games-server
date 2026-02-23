/**
 * Migration: Create Language Tags
 * Creates a "Language" tag category and adds tags for all 27 supported languages
 * These tags will be used instead of the separate language filter panel
 */

-- Step 1: Ensure the Language category exists
INSERT INTO library.tag_categories (type, name, description)
VALUES ('Language', 'Language', 'Document language tags')
ON CONFLICT DO NOTHING;

-- Step 2: Get the Language category ID for reference
-- Note: We'll use subqueries in the tag inserts below

-- Step 3: Create language tags (27 languages)
INSERT INTO library.tags (category_id, name, description, usage_count)
SELECT
  tc.id,
  lang_name,
  CONCAT('Documents in ', lang_name),
  0
FROM
  library.tag_categories tc,
  (VALUES
    ('English'),
    ('German'),
    ('Spanish'),
    ('French'),
    ('Italian'),
    ('Portuguese'),
    ('Polish'),
    ('Russian'),
    ('Turkish'),
    ('Korean'),
    ('Japanese'),
    ('Chinese'),
    ('Dutch'),
    ('Greek'),
    ('Danish'),
    ('Swedish'),
    ('Finnish'),
    ('Romanian'),
    ('Hungarian'),
    ('Czech'),
    ('Albanian'),
    ('Basque'),
    ('Farsi'),
    ('Esperanto'),
    ('Serbian'),
    ('Macedonian'),
    ('Multilingual')
  ) AS languages(lang_name)
WHERE tc.type = 'Language'
ON CONFLICT (category_id, name) DO NOTHING;
