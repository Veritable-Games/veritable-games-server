-- Phase 2: Merge Plural/Singular Tag Duplicates (Fixed)
-- Consolidate document associations to canonical singular forms

BEGIN;

-- Show statistics before merge
SELECT 'Before Phase 2' as phase,
  COUNT(*) as total_tags
FROM shared.tags;

-- Helper function to merge tags (handles conflicts properly)
CREATE OR REPLACE FUNCTION merge_tags(p_keep_name TEXT, p_delete_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_keep_id INT;
  v_delete_id INT;
  v_migrated_lib INT;
  v_migrated_anarch INT;
BEGIN
  -- Get IDs
  SELECT id INTO v_keep_id FROM shared.tags WHERE name = p_keep_name;
  SELECT id INTO v_delete_id FROM shared.tags WHERE name = p_delete_name;
  
  -- Skip if either tag doesn't exist
  IF v_keep_id IS NULL OR v_delete_id IS NULL THEN
    RAISE NOTICE 'Skipping % → %: One or both tags not found', p_delete_name, p_keep_name;
    RETURN;
  END IF;
  
  -- Migrate library documents
  -- First, delete any that would create conflicts (doc already has both tags)
  DELETE FROM library.library_document_tags
  WHERE tag_id = v_delete_id
    AND document_id IN (
      SELECT document_id FROM library.library_document_tags WHERE tag_id = v_keep_id
    );
  
  -- Now safely update the rest
  UPDATE library.library_document_tags
  SET tag_id = v_keep_id
  WHERE tag_id = v_delete_id;
  
  GET DIAGNOSTICS v_migrated_lib = ROW_COUNT;
  
  -- Migrate anarchist documents
  -- First, delete any that would create conflicts
  DELETE FROM anarchist.document_tags
  WHERE tag_id = v_delete_id
    AND document_id IN (
      SELECT document_id FROM anarchist.document_tags WHERE tag_id = v_keep_id
    );
  
  -- Now safely update the rest
  UPDATE anarchist.document_tags
  SET tag_id = v_keep_id
  WHERE tag_id = v_delete_id;
  
  GET DIAGNOSTICS v_migrated_anarch = ROW_COUNT;
  
  -- Delete the redundant tag
  DELETE FROM shared.tags WHERE id = v_delete_id;
  
  RAISE NOTICE 'Merged % → % (lib: %, anarch: %)', p_delete_name, p_keep_name, v_migrated_lib, v_migrated_anarch;
END;
$$ LANGUAGE plpgsql;

-- Top 50 plural/singular merges (keep singular, delete plural)

-- High impact (100+ combined documents)
SELECT merge_tags('anarchism', 'anarchisms');
SELECT merge_tags('anarchist', 'anarchists');
SELECT merge_tags('academic', 'academics');
SELECT merge_tags('action', 'actions');
SELECT merge_tags('architecture', 'architectures');
SELECT merge_tags('anti-work', 'anti-works');
SELECT merge_tags('anarchist movement', 'anarchist movements');

-- Medium impact (20-100 documents)
SELECT merge_tags('american', 'americans');
SELECT merge_tags('archive', 'archives');
SELECT merge_tags('abuse', 'abuses');
SELECT merge_tags('anarchist prisoner', 'anarchist prisoners');
SELECT merge_tags('america', 'americas');
SELECT merge_tags('anarcho', 'anarchos');
SELECT merge_tags('african', 'africans');
SELECT merge_tags('agent', 'agents');
SELECT merge_tags('affect', 'affects');
SELECT merge_tags('activist', 'activists');

-- Lower impact (5-20 documents)
SELECT merge_tags('anarquismo', 'anarquismos');
SELECT merge_tags('anna', 'annas');
SELECT merge_tags('agreement', 'agreements');
SELECT merge_tags('animal', 'animals');
SELECT merge_tags('aid', 'aids');
SELECT merge_tags('age', 'ages');
SELECT merge_tags('appraisal', 'appraisals');
SELECT merge_tags('animation', 'animations');
SELECT merge_tags('answer', 'answers');
SELECT merge_tags('abolitionist', 'abolitionists');
SELECT merge_tags('alternative', 'alternatives');
SELECT merge_tags('adult', 'adults');
SELECT merge_tags('account', 'accounts');
SELECT merge_tags('actor', 'actors');

-- Additional pairs
SELECT merge_tags('anarchiste', 'anarchistes');
SELECT merge_tags('anarquista', 'anarquistas');
SELECT merge_tags('accomplice', 'accomplices');
SELECT merge_tags('activation', 'activations');
SELECT merge_tags('affair', 'affairs');
SELECT merge_tags('alien', 'aliens');
SELECT merge_tags('alloy', 'alloys');
SELECT merge_tags('agrivoltaic', 'agrivoltaics');
SELECT merge_tags('adam', 'adams');
SELECT merge_tags('adventure', 'adventures');
SELECT merge_tags('amusement', 'amusements');
SELECT merge_tags('anarchist jurisdiction', 'anarchist jurisdictions');
SELECT merge_tags('andrew', 'andrews');
SELECT merge_tags('animator', 'animators');
SELECT merge_tags('antagonist', 'antagonists');
SELECT merge_tags('apartment', 'apartments');
SELECT merge_tags('application', 'applications');

-- Drop helper function
DROP FUNCTION merge_tags(TEXT, TEXT);

-- Show results
SELECT 'After Phase 2' as phase,
  COUNT(*) as total_tags
FROM shared.tags;

COMMIT;
