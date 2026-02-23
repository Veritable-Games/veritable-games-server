-- Migration: Create page_headers table (PostgreSQL)
-- Purpose: Store editable page headers (titles and descriptions) for donate/* pages
-- Schema: system

CREATE TABLE IF NOT EXISTS page_headers (
  id SERIAL PRIMARY KEY,
  page_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by page slug
CREATE INDEX IF NOT EXISTS idx_page_headers_slug ON page_headers(page_slug);

-- Insert default headers for donate pages
INSERT INTO page_headers (page_slug, title, description) VALUES
  ('donate', 'Support Veritable Games', 'Help fund independent game development and community growth.'),
  ('donate-transparency', 'Financial Transparency', 'Our commitment to open finances and accountability.'),
  ('donate-manage', 'Your Support Story', 'Track your contributions and manage subscriptions.')
ON CONFLICT (page_slug) DO NOTHING;
