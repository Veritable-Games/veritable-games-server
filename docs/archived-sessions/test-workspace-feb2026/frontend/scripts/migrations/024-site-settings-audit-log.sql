-- ============================================================================
-- Migration: 024-site-settings-audit-log.sql
-- Created: February 18, 2026
-- Purpose: Add audit logging for site_settings table to track critical changes
-- ============================================================================
--
-- BACKGROUND:
-- On Feb 18, 2026, the site became publicly accessible after a deployment
-- because maintenanceMode was set to 'false' in the database (migration default)
-- but there was no audit trail to see when/how it changed.
--
-- SOLUTION:
-- 1. Create audit table to track all changes to site_settings
-- 2. Add trigger to automatically log changes
-- 3. Provide visibility into who changed what and when
--
-- INCIDENT: See docs/incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md
-- ============================================================================

-- Create audit table
CREATE TABLE IF NOT EXISTS system.site_settings_audit (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users.users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_audit_key ON system.site_settings_audit(key);
CREATE INDEX IF NOT EXISTS idx_site_settings_audit_changed_at ON system.site_settings_audit(changed_at DESC);

-- Add comment
COMMENT ON TABLE system.site_settings_audit IS 'Audit log for all changes to site_settings. Tracks who changed what and when for security and compliance.';

-- ============================================================================
-- Trigger Function: Log all changes to site_settings
-- ============================================================================
CREATE OR REPLACE FUNCTION system.audit_site_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT operations
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO system.site_settings_audit (key, old_value, new_value, changed_by, operation)
        VALUES (NEW.key, NULL, NEW.value, NEW.updated_by, 'INSERT');
        RETURN NEW;

    -- For UPDATE operations
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only log if value actually changed
        IF (OLD.value IS DISTINCT FROM NEW.value) THEN
            INSERT INTO system.site_settings_audit (key, old_value, new_value, changed_by, operation)
            VALUES (NEW.key, OLD.value, NEW.value, NEW.updated_by, 'UPDATE');
        END IF;
        RETURN NEW;

    -- For DELETE operations
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO system.site_settings_audit (key, old_value, new_value, changed_by, operation)
        VALUES (OLD.key, OLD.value, NULL, OLD.updated_by, 'DELETE');
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS audit_site_settings_trigger ON system.site_settings;
CREATE TRIGGER audit_site_settings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON system.site_settings
    FOR EACH ROW
    EXECUTE FUNCTION system.audit_site_settings_changes();

-- ============================================================================
-- Backfill: Create initial audit entry for current maintenanceMode value
-- ============================================================================
-- This provides a baseline for future changes
INSERT INTO system.site_settings_audit (key, old_value, new_value, changed_by, operation, changed_at)
SELECT
    'maintenanceMode',
    NULL,
    value,
    NULL, -- No user ID for system-created entry
    'INSERT',
    updated_at
FROM system.site_settings
WHERE key = 'maintenanceMode'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- View: Easy access to recent setting changes
-- ============================================================================
CREATE OR REPLACE VIEW system.site_settings_changes AS
SELECT
    a.id,
    a.key,
    a.old_value,
    a.new_value,
    a.operation,
    a.changed_at,
    u.username AS changed_by_user,
    a.changed_by AS changed_by_id
FROM system.site_settings_audit a
LEFT JOIN users.users u ON a.changed_by = u.id
ORDER BY a.changed_at DESC;

COMMENT ON VIEW system.site_settings_changes IS 'Human-readable view of site_settings audit log with username resolution';

-- Grant permissions (read-only for admins)
-- Uncomment if using role-based access control:
-- GRANT SELECT ON system.site_settings_audit TO admin_role;
-- GRANT SELECT ON system.site_settings_changes TO admin_role;
