-- Remove twitter_url column from users table
-- Twitter/X is no longer officially supported
-- Users should use custom fields if they want to add Twitter links
-- Created: 2026-02-15

ALTER TABLE users.users DROP COLUMN IF EXISTS twitter_url;
