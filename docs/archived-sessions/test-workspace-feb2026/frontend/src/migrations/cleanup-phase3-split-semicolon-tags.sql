-- Phase 3: Split Semicolon-Separated Multi-Tags
-- Parse and split 259 multi-tags into individual component tags

BEGIN;

-- Show statistics before split
SELECT 'Before Phase 3' as phase,
  COUNT(*) as total_tags,
  COUNT(*) FILTER (WHERE name LIKE '%;%') as semicolon_tags
FROM shared.tags;

-- Create function to split multi-tags
CREATE OR REPLACE FUNCTION split_multitag(p_tag_id INT, p_tag_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_component TEXT;
  v_component_trimmed TEXT;
  v_component_id INT;
  v_components TEXT[];
  v_lib_docs INT[];
  v_anarch_docs INT[];
BEGIN
  -- Skip if tag doesn't contain semicolon
  IF p_tag_name NOT LIKE '%;%' THEN
    RETURN;
  END IF;
  
  -- Get all documents currently using this multi-tag
  SELECT ARRAY_AGG(DISTINCT document_id) INTO v_lib_docs
  FROM library.library_document_tags
  WHERE tag_id = p_tag_id;
  
  SELECT ARRAY_AGG(DISTINCT document_id) INTO v_anarch_docs
  FROM anarchist.document_tags
  WHERE tag_id = p_tag_id;
  
  -- Split by semicolon
  v_components := string_to_array(p_tag_name, ';');
  
  -- Process each component
  FOREACH v_component IN ARRAY v_components
  LOOP
    -- Trim whitespace
    v_component_trimmed := TRIM(v_component);
    
    -- Skip empty components
    IF v_component_trimmed = '' THEN
      CONTINUE;
    END IF;
    
    -- Get or create the component tag
    SELECT id INTO v_component_id FROM shared.tags WHERE name = v_component_trimmed;
    
    IF v_component_id IS NULL THEN
      -- Create new tag
      INSERT INTO shared.tags (name, description)
      VALUES (v_component_trimmed, 'Split from multi-tag: ' || p_tag_name)
      RETURNING id INTO v_component_id;
    END IF;
    
    -- Assign component tag to all library documents that had the multi-tag
    IF v_lib_docs IS NOT NULL THEN
      INSERT INTO library.library_document_tags (document_id, tag_id)
      SELECT unnest(v_lib_docs), v_component_id
      ON CONFLICT (document_id, tag_id) DO NOTHING;
    END IF;
    
    -- Assign component tag to all anarchist documents that had the multi-tag
    IF v_anarch_docs IS NOT NULL THEN
      INSERT INTO anarchist.document_tags (document_id, tag_id)
      SELECT unnest(v_anarch_docs), v_component_id
      ON CONFLICT (document_id, tag_id) DO NOTHING;
    END IF;
  END LOOP;
  
  -- Delete the original multi-tag (CASCADE will remove document associations)
  DELETE FROM shared.tags WHERE id = p_tag_id;
  
  RAISE NOTICE 'Split multi-tag "%" into % components', 
    SUBSTRING(p_tag_name, 1, 60), array_length(v_components, 1);
END;
$$ LANGUAGE plpgsql;

-- Get all semicolon tags and split them
-- Using DO block to iterate through results
DO $$
DECLARE
  v_tag RECORD;
  v_count INT := 0;
BEGIN
  FOR v_tag IN 
    SELECT id, name 
    FROM shared.tags 
    WHERE name LIKE '%;%'
    ORDER BY name
  LOOP
    PERFORM split_multitag(v_tag.id, v_tag.name);
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Processed % multi-tags total', v_count;
END $$;

-- Drop helper function
DROP FUNCTION split_multitag(INT, TEXT);

-- Show results
SELECT 'After Phase 3' as phase,
  COUNT(*) as total_tags,
  COUNT(*) FILTER (WHERE name LIKE '%;%') as semicolon_tags_remaining,
  COUNT(*) FILTER (WHERE description LIKE 'Split from multi-tag:%') as new_component_tags
FROM shared.tags;

COMMIT;
