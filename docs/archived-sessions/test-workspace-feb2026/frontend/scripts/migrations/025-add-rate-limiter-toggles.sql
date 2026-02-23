-- Migration 025: Add Rate Limiter Toggle Settings
-- Date: 2026-02-19
-- Description: Add individual toggles for each rate limiter to admin settings
--
-- This migration adds 7 boolean settings to control rate limiters independently:
-- - topicCreate: 5 per hour
-- - replyCreate: 30 per hour
-- - search: 100 per minute
-- - auth: 10 per 15 minutes
-- - fileUpload: 10 per hour
-- - messageSend: 20 per hour
-- - wikiCreate: 10 per hour
--
-- All default to 'true' (enabled) for backward compatibility and security.

INSERT INTO system.site_settings (key, value, updated_at) VALUES
    ('rateLimitTopicCreateEnabled', 'true', NOW()),
    ('rateLimitReplyCreateEnabled', 'true', NOW()),
    ('rateLimitSearchEnabled', 'true', NOW()),
    ('rateLimitAuthEnabled', 'true', NOW()),
    ('rateLimitFileUploadEnabled', 'true', NOW()),
    ('rateLimitMessageSendEnabled', 'true', NOW()),
    ('rateLimitWikiCreateEnabled', 'true', NOW())
ON CONFLICT (key) DO NOTHING;
