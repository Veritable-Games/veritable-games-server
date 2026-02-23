-- Create anarchist.documents table
CREATE TABLE IF NOT EXISTS anarchist.documents (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  publication_date TEXT,
  language TEXT DEFAULT 'en',
  file_path TEXT NOT NULL,
  source_url TEXT,
  document_type TEXT DEFAULT 'article',
  notes TEXT,
  original_format TEXT DEFAULT 'muse',
  category TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create anarchist.tags table
CREATE TABLE IF NOT EXISTS anarchist.tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create anarchist.document_tags junction table
CREATE TABLE IF NOT EXISTS anarchist.document_tags (
  document_id INTEGER NOT NULL REFERENCES anarchist.documents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES anarchist.tags(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_slug
  ON anarchist.documents(slug);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_language
  ON anarchist.documents(language);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_category
  ON anarchist.documents(category);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_title
  ON anarchist.documents(title);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_author
  ON anarchist.documents(author);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_view_count
  ON anarchist.documents(view_count DESC);

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_created_at
  ON anarchist.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anarchist_tags_usage_count
  ON anarchist.tags(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_anarchist_document_tags_tag
  ON anarchist.document_tags(tag_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_fulltext
  ON anarchist.documents
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(author, '') || ' ' || COALESCE(notes, '')));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION anarchist.update_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anarchist_documents_update_timestamp ON anarchist.documents;

CREATE TRIGGER anarchist_documents_update_timestamp
BEFORE UPDATE ON anarchist.documents
FOR EACH ROW
EXECUTE FUNCTION anarchist.update_documents_timestamp();

-- Trigger to update tag usage counts
CREATE OR REPLACE FUNCTION anarchist.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE anarchist.tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE anarchist.tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anarchist_document_tags_usage_trigger ON anarchist.document_tags;

CREATE TRIGGER anarchist_document_tags_usage_trigger
AFTER INSERT OR DELETE ON anarchist.document_tags
FOR EACH ROW
EXECUTE FUNCTION anarchist.update_tag_usage_count();
