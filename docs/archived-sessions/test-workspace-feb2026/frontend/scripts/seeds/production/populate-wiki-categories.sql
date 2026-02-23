-- Populate Wiki Categories in Production PostgreSQL
-- This script inserts the 10 root wiki categories into the existing production database
-- Run on 192.168.1.15 PostgreSQL instance
-- Usage: psql postgresql://postgres:PASSWORD@veritable-games-postgres-new:5432/veritable_games -f populate-wiki-categories.sql

-- Delete existing categories if re-running (idempotent)
DELETE FROM wiki.wiki_categories WHERE id IN (
  'uncategorized', 'archive', 'autumn', 'cosmic-knights', 'dodec',
  'journals', 'noxii', 'on-command', 'systems', 'tutorials'
);

-- Insert 10 root categories
INSERT INTO wiki.wiki_categories (id, parent_id, name, description, color, icon, sort_order, created_at, is_public) VALUES
('uncategorized', NULL, 'Uncategorized', 'Pages without a specific category', '#9CA3AF', 'help-circle', 0, NOW(), true),
('archive', NULL, 'Archive', 'Historical content and archived materials', '#6B7280', 'archive', 1, NOW(), false),
('autumn', NULL, 'Autumn', 'Autumn-related content and resources', '#D97706', 'leaf', 2, NOW(), true),
('cosmic-knights', NULL, 'Cosmic Knights', 'Cosmic Knights universe and lore', '#8B5CF6', 'star', 3, NOW(), true),
('dodec', NULL, 'Dodec', 'Dodecahedron system documentation', '#3B82F6', 'cube', 4, NOW(), true),
('journals', NULL, 'Journals', 'User journal entries and personal logs', '#EC4899', 'book-open', 5, NOW(), false),
('noxii', NULL, 'Noxii', 'Noxii civilization and culture', '#F59E0B', 'users', 6, NOW(), true),
('on-command', NULL, 'On Command', 'On Command project documentation', '#10B981', 'terminal', 7, NOW(), true),
('systems', NULL, 'Systems', 'System guides and technical documentation', '#6366F1', 'settings', 8, NOW(), true),
('tutorials', NULL, 'Tutorials', 'How-to guides and learning materials', '#14B8A6', 'graduation-cap', 9, NOW(), true);

-- Verify insertion
SELECT id, name, is_public, sort_order FROM wiki.wiki_categories ORDER BY sort_order;
