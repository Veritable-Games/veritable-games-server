-- Migration: Create tag translation mapping table
-- Date: 2025-11-19
-- Purpose: Enable language-specific tag filtering with AI-powered translation mappings

-- Create tag_translations table to store conceptual mappings between tags in different languages
CREATE TABLE IF NOT EXISTS shared.tag_translations (
  id SERIAL PRIMARY KEY,
  source_tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
  target_tag_id INTEGER NOT NULL REFERENCES shared.tags(id) ON DELETE CASCADE,
  source_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 1.0, -- Translation confidence (0.00-1.00)
  translation_method VARCHAR(50) DEFAULT 'ai', -- 'ai', 'manual', 'verified'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_translation_pair UNIQUE (source_tag_id, target_tag_id, source_language, target_language),
  CONSTRAINT different_tags CHECK (source_tag_id != target_tag_id),
  CONSTRAINT different_languages CHECK (source_language != target_language),
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_tag_translations_source ON shared.tag_translations(source_tag_id, source_language);
CREATE INDEX idx_tag_translations_target ON shared.tag_translations(target_tag_id, target_language);
CREATE INDEX idx_tag_translations_languages ON shared.tag_translations(source_language, target_language);
CREATE INDEX idx_tag_translations_confidence ON shared.tag_translations(confidence_score DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION shared.update_tag_translation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
CREATE TRIGGER tag_translation_update_timestamp
BEFORE UPDATE ON shared.tag_translations
FOR EACH ROW
EXECUTE FUNCTION shared.update_tag_translation_timestamp();

-- Add helpful comments
COMMENT ON TABLE shared.tag_translations IS 'Maps conceptually equivalent tags across languages (e.g., anarchism ↔ anarquismo)';
COMMENT ON COLUMN shared.tag_translations.source_tag_id IS 'Tag ID in source language';
COMMENT ON COLUMN shared.tag_translations.target_tag_id IS 'Translated tag ID in target language';
COMMENT ON COLUMN shared.tag_translations.confidence_score IS 'Translation confidence from AI (0.00-1.00)';
COMMENT ON COLUMN shared.tag_translations.translation_method IS 'How translation was created: ai, manual, verified';
