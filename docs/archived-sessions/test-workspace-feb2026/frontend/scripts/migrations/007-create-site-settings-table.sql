-- ============================================================================
-- Migration: 007-create-site-settings-table.sql
-- Created: November 30, 2025
-- Purpose: Create site_settings table for admin-managed site configuration
-- ============================================================================

-- Ensure system schema exists
CREATE SCHEMA IF NOT EXISTS system;

-- Create site_settings table
CREATE TABLE IF NOT EXISTS system.site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES users.users(id)
);

-- Add comment
COMMENT ON TABLE system.site_settings IS 'Key-value store for site-wide settings managed by admin UI';

-- Insert default settings
INSERT INTO system.site_settings (key, value, updated_at) VALUES
    ('siteName', 'Veritable Games', NOW()),
    ('siteDescription', 'Creating memorable gaming experiences', NOW()),
    ('maintenanceMode', 'false', NOW()),
    ('maintenanceMessage', 'We are currently performing scheduled maintenance. Please check back soon.', NOW()),
    ('registrationEnabled', 'true', NOW()),
    ('emailVerification', 'false', NOW()),
    ('wikiEnabled', 'true', NOW()),
    ('maxUploadSize', '5', NOW()),
    ('allowedFileTypes', 'jpg,png,gif,pdf', NOW())
ON CONFLICT (key) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON system.site_settings TO web_anon;
-- GRANT ALL ON system.site_settings TO authenticated;
