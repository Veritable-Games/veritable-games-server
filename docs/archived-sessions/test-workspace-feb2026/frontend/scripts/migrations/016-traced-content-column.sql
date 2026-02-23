-- Add traced_content column for full-document tracing
-- This stores the complete human-edited content layer

ALTER TABLE content.projects
  ADD COLUMN IF NOT EXISTS traced_content TEXT;

-- Comment explaining the column
COMMENT ON COLUMN content.projects.traced_content IS 'Full document human-edited content (the traced layer). When present, this is shown instead of content field for public viewers.';
