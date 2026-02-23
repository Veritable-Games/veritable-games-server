'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import {
  SettingsSection,
  SettingsToggle,
  SettingsToggleGroup,
  SettingsSaveButton,
  SettingsErrorDisplay,
} from '@/components/settings/ui';
import type { SiteSettings } from '@/lib/settings/service';
import { logger } from '@/lib/utils/logger';

interface SiteSettingsManagerProps {
  className?: string;
}

interface LockdownStatus {
  enabled: boolean;
  envOverrideActive: boolean;
  databaseValue: boolean;
}

export default function SiteSettingsManager({ className }: SiteSettingsManagerProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lockdownStatus, setLockdownStatus] = useState<LockdownStatus | null>(null);

  // Track initial values for change detection
  const initialValuesRef = useRef<SiteSettings | null>(null);

  // Check current lockdown status from the public API
  const checkLockdownStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/maintenance');
      const data = await res.json();
      if (data.success && data.data) {
        setLockdownStatus({
          enabled: data.data.enabled,
          envOverrideActive: data.data.envOverrideActive || false,
          databaseValue: data.data.databaseValue ?? data.data.enabled,
        });
      }
    } catch {
      // Silent fail - status indicator just won't show
    }
  }, []);

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchJSON('/api/admin/settings', {
        method: 'GET',
      });

      if (result.success) {
        setSettings(result.data);
        initialValuesRef.current = result.data;
      } else {
        setError(result.error || 'Failed to load settings');
      }
    } catch (err: unknown) {
      logger.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    checkLockdownStatus();
  }, [checkLockdownStatus]);

  // Check for changes
  const hasChanges = useMemo(() => {
    if (!settings || !initialValuesRef.current) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialValuesRef.current);
  }, [settings]);

  // Update a single setting
  const updateSetting = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSettings(prev => (prev ? { ...prev, [key]: value } : null));
    setError(null);
    setSuccess(false);
  };

  // Save settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !hasChanges) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      logger.info('[SiteSettings] Saving settings:', settings);

      const result = await fetchJSON('/api/admin/settings', {
        method: 'PUT',
        body: settings,
      });

      logger.info('[SiteSettings] API response:', result);

      if (result.success) {
        // Force cache invalidation for immediate propagation
        try {
          logger.info('[SiteSettings] Invalidating cache...');
          await fetchJSON('/api/admin/settings/invalidate-cache', { method: 'POST' });
          logger.info('[SiteSettings] Cache invalidated');
        } catch (cacheErr) {
          logger.warn('[SiteSettings] Cache invalidation failed:', cacheErr);
          // Cache invalidation is optional, don't fail the save
        }

        // Wait a moment for caches to clear
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify the change took effect
        logger.info('[SiteSettings] Checking lockdown status...');
        await checkLockdownStatus();

        initialValuesRef.current = result.data;
        setSettings(result.data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
        logger.info('[SiteSettings] Save complete!');
      } else {
        logger.error('[SiteSettings] Save failed:', result.error);
        setError(result.error || 'Failed to save settings');
      }
    } catch (err: unknown) {
      logger.error('[SiteSettings] Exception during save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading skeletons */}
        <SettingsSection title="Site Lockdown">
          <div className="animate-pulse">
            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <div className="mb-1 h-4 w-48 rounded bg-neutral-700"></div>
                <div className="h-3 w-64 rounded bg-neutral-700"></div>
              </div>
              <div className="h-6 w-11 rounded-full bg-neutral-700"></div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="User Registration">
          <div className="animate-pulse space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="mb-1 h-4 w-40 rounded bg-neutral-700"></div>
                  <div className="h-3 w-56 rounded bg-neutral-700"></div>
                </div>
                <div className="h-6 w-11 rounded-full bg-neutral-700"></div>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={`rounded-lg border border-red-500/50 bg-red-900/20 p-6 ${className}`}>
        <p className="text-red-400">{error || 'Failed to load settings'}</p>
        <button
          onClick={loadSettings}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className={`space-y-6 ${className}`}>
      {/* Error and Success Messages */}
      <SettingsErrorDisplay
        error={error}
        success={success ? 'Settings saved successfully!' : undefined}
      />

      {/* Site Lockdown Section */}
      <SettingsSection title="Site Lockdown" description="Control public access to the site">
        {/* Current Lockdown State Indicator */}
        {lockdownStatus && (
          <div
            className={`mb-4 rounded-lg border p-4 ${
              lockdownStatus.enabled
                ? 'border-yellow-500/50 bg-yellow-900/30'
                : 'border-green-500/50 bg-green-900/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  lockdownStatus.enabled ? 'animate-pulse bg-yellow-500' : 'bg-green-500'
                }`}
              />
              <span className="font-medium text-white">
                {lockdownStatus.enabled
                  ? 'Site is LOCKED - Login required for access'
                  : 'Site is PUBLIC - Open to everyone'}
              </span>
            </div>
            {lockdownStatus.envOverrideActive && (
              <p className="mt-2 text-sm text-yellow-400">
                ⚠️ Environment override is active. The toggle below cannot disable lockdown until
                LOCKDOWN_EMERGENCY_OVERRIDE is removed from the server configuration.
              </p>
            )}
          </div>
        )}

        <SettingsToggle
          label="Enable Site Lockdown"
          description="When enabled, only logged-in users can access the site"
          checked={settings.maintenanceMode}
          onChange={checked => updateSetting('maintenanceMode', checked)}
        />
      </SettingsSection>

      {/* Registration Section */}
      <SettingsSection title="User Registration" description="Control user registration settings">
        <SettingsToggle
          label="Allow Registration"
          description="Enable new user registration (requires invitation token)"
          checked={settings.registrationEnabled}
          onChange={checked => updateSetting('registrationEnabled', checked)}
        />
      </SettingsSection>

      {/* Rate Limiting Section */}
      <SettingsSection
        title="Rate Limiting"
        description="Control rate limiters for API endpoints (disable for testing/debugging)"
      >
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl text-yellow-500">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-300">Security Warning</p>
              <p className="mt-1 text-xs text-yellow-400">
                Disabling rate limiters removes protection against spam and abuse. Only disable
                temporarily for testing or emergency situations.
              </p>
            </div>
          </div>
        </div>

        <SettingsToggleGroup
          label=""
          options={[
            {
              id: 'rateLimitTopicCreateEnabled',
              label: 'Topic Creation (5 per hour)',
              description: 'Rate limit forum topic creation',
              checked: settings.rateLimitTopicCreateEnabled,
            },
            {
              id: 'rateLimitReplyCreateEnabled',
              label: 'Reply Creation (30 per hour)',
              description: 'Rate limit forum replies',
              checked: settings.rateLimitReplyCreateEnabled,
            },
            {
              id: 'rateLimitSearchEnabled',
              label: 'Search Queries (100 per minute)',
              description: 'Rate limit search requests (forums & wiki)',
              checked: settings.rateLimitSearchEnabled,
            },
            {
              id: 'rateLimitAuthEnabled',
              label: 'Authentication (10 per 15 minutes)',
              description: 'Rate limit login, register, and password reset',
              checked: settings.rateLimitAuthEnabled,
            },
            {
              id: 'rateLimitFileUploadEnabled',
              label: 'File Uploads (10 per hour)',
              description: 'Rate limit avatar uploads',
              checked: settings.rateLimitFileUploadEnabled,
            },
            {
              id: 'rateLimitMessageSendEnabled',
              label: 'Message Sending (20 per hour)',
              description: 'Rate limit donations and messaging',
              checked: settings.rateLimitMessageSendEnabled,
            },
            {
              id: 'rateLimitWikiCreateEnabled',
              label: 'Wiki Creation (10 per hour)',
              description: 'Rate limit wiki page creation (not currently used)',
              checked: settings.rateLimitWikiCreateEnabled,
            },
          ]}
          onChange={(id, checked) => {
            updateSetting(id as keyof SiteSettings, checked);
          }}
          showDividers={true}
        />
      </SettingsSection>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t border-neutral-700/50 pt-6">
        <div className="text-sm text-neutral-400">
          {hasChanges ? 'You have unsaved changes.' : 'All changes saved'}
        </div>
        <SettingsSaveButton
          type="submit"
          saveState={saving ? 'saving' : success ? 'saved' : 'idle'}
          disabled={saving || !hasChanges}
          text={{
            idle: hasChanges ? 'Save Changes' : 'No Changes',
            saving: 'Saving...',
            saved: 'Saved!',
            error: 'Save Failed',
          }}
        />
      </div>
    </form>
  );
}
