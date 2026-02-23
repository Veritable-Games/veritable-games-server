-- Phase 2: Merge Plural/Singular Tag Duplicates
-- Consolidate document associations to canonical singular forms

BEGIN;

-- Show statistics before merge
SELECT 'Before Phase 2' as phase,
  COUNT(*) as total_tags
FROM shared.tags;

-- Helper function to merge tags
CREATE OR REPLACE FUNCTION merge_tags(p_keep_name TEXT, p_delete_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_keep_id INT;
  v_delete_id INT;
BEGIN
  -- Get IDs
  SELECT id INTO v_keep_id FROM shared.tags WHERE name = p_keep_name;
  SELECT id INTO v_delete_id FROM shared.tags WHERE name = p_delete_name;
  
  -- Skip if either tag doesn't exist
  IF v_keep_id IS NULL OR v_delete_id IS NULL THEN
    RAISE NOTICE 'Skipping % → %: One or both tags not found', p_delete_name, p_keep_name;
    RETURN;
  END IF;
  
  -- Migrate library documents (ignore conflicts - document already has both tags)
  UPDATE library.library_document_tags
  SET tag_id = v_keep_id
  WHERE tag_id = v_delete_id
  ON CONFLICT (document_id, tag_id) DO NOTHING;
  
  -- Migrate anarchist documents (ignore conflicts)
  UPDATE anarchist.document_tags
  SET tag_id = v_keep_id
  WHERE tag_id = v_delete_id
  ON CONFLICT (document_id, tag_id) DO NOTHING;
  
  -- Delete the redundant tag
  DELETE FROM shared.tags WHERE id = v_delete_id;
  
  RAISE NOTICE 'Merged % → %', p_delete_name, p_keep_name;
END;
$$ LANGUAGE plpgsql;

-- Top 50 plural/singular merges (keep singular, delete plural)
-- Ordered by impact (high document counts first)

-- High impact (100+ combined documents)
SELECT merge_tags('anarchism', 'anarchisms');      -- 1839 + 2
SELECT merge_tags('anarchist', 'anarchists');      -- 319 + 116
SELECT merge_tags('academic', 'academics');        -- 292 + 2
SELECT merge_tags('action', 'actions');            -- 148 + 47
SELECT merge_tags('architecture', 'architectures'); -- 147 + 2
SELECT merge_tags('anti-work', 'anti-works');      -- 142 + 3
SELECT merge_tags('anarchist movement', 'anarchist movements'); -- 173 + 1

-- Medium impact (20-100 documents)
SELECT merge_tags('american', 'americans');        -- 86 + 19
SELECT merge_tags('archive', 'archives');          -- 75 + 14
SELECT merge_tags('abuse', 'abuses');              -- 57 + 2
SELECT merge_tags('anarchist prisoner', 'anarchist prisoners'); -- 41 + 38
SELECT merge_tags('america', 'americas');          -- 40 + 8
SELECT merge_tags('anarcho', 'anarchos');          -- 34 + 2
SELECT merge_tags('african', 'africans');          -- 33 + 1
SELECT merge_tags('agent', 'agents');              -- 29 + 24
SELECT merge_tags('affect', 'affects');            -- 26 + 4
SELECT merge_tags('activist', 'activists');        -- 9 + 25

-- Lower impact but still valuable (5-20 documents)
SELECT merge_tags('anarquismo', 'anarquismos');    -- 238 + 2
SELECT merge_tags('anna', 'annas');                -- 21 + 12
SELECT merge_tags('agreement', 'agreements');      -- 19 + 5
SELECT merge_tags('animal', 'animals');            -- 13 + 16
SELECT merge_tags('aid', 'aids');                  -- 17 + 2
SELECT merge_tags('age', 'ages');                  -- 14 + 1
SELECT merge_tags('appraisal', 'appraisals');      -- 9 + 1
SELECT merge_tags('animation', 'animations');      -- 9 + 2
SELECT merge_tags('answer', 'answers');            -- 8 + 5
SELECT merge_tags('abolitionist', 'abolitionists'); -- 8 + 2
SELECT merge_tags('alternative', 'alternatives');  -- 8 + 2
SELECT merge_tags('adult', 'adults');              -- 7 + 7
SELECT merge_tags('account', 'accounts');          -- 6 + 2
SELECT merge_tags('actor', 'actors');              -- 5 + 1

-- Additional pairs
SELECT merge_tags('anarchiste', 'anarchistes');    -- 4 + 1
SELECT merge_tags('anarquista', 'anarquistas');    -- 3 + 6
SELECT merge_tags('accomplice', 'accomplices');    -- 1 + 2
SELECT merge_tags('activation', 'activations');    -- 2 + 4
SELECT merge_tags('affair', 'affairs');            -- 1 + 1
SELECT merge_tags('alien', 'aliens');              -- 1 + 3
SELECT merge_tags('alloy', 'alloys');              -- 3 + 2
SELECT merge_tags('agrivoltaic', 'agrivoltaics');  -- 2 + 3
SELECT merge_tags('adam', 'adams');                -- 1 + 2
SELECT merge_tags('adventure', 'adventures');      -- 3 + 1
SELECT merge_tags('amusement', 'amusements');      -- 2 + 2
SELECT merge_tags('anarchist jurisdiction', 'anarchist jurisdictions'); -- 1 + 4
SELECT merge_tags('andrew', 'andrews');            -- 2 + 1
SELECT merge_tags('animator', 'animators');        -- 4 + 2
SELECT merge_tags('antagonist', 'antagonists');    -- 1 + 2
SELECT merge_tags('apartment', 'apartments');      -- 4 + 1
SELECT merge_tags('application', 'applications');  -- 1 + 3

-- Drop helper function
DROP FUNCTION merge_tags(TEXT, TEXT);

-- Show results
SELECT 'After Phase 2' as phase,
  COUNT(*) as total_tags,
  (SELECT COUNT(*) FROM shared.tags WHERE name LIKE '%s' AND EXISTS (
    SELECT 1 FROM shared.tags t2 
    WHERE LOWER(t2.name) = LOWER(SUBSTRING(shared.tags.name, 1, LENGTH(shared.tags.name)-1))
    AND t2.name != shared.tags.name
  )) as remaining_plural_duplicates
FROM shared.tags;

COMMIT;
