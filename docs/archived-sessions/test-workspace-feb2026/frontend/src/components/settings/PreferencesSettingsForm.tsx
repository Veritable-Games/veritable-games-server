'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/users/types';
import {
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
  SettingsToggleGroup,
  SettingsErrorDisplay,
  AutoSaveIndicator,
} from '@/components/settings/ui';
import { useAutoSave } from '@/hooks/useAutoSave';
import { logger } from '@/lib/utils/logger';

interface PreferencesSettingsFormProps {
  user: User;
}

interface PreferencesData {
  // Time & Date
  timezone: string;
  dateFormat: string;
  timeFormat: '12' | '24';

  // Notifications
  emailNotifications: {
    newMessages: boolean;
    mentions: boolean;
  };
  desktopNotifications: boolean;
}

const DEFAULT_PREFERENCES: PreferencesData = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12',
  emailNotifications: {
    newMessages: true,
    mentions: true,
  },
  desktopNotifications: false,
};

export function PreferencesSettingsForm({ user }: PreferencesSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsNotifications, setSupportsNotifications] = useState(false);

  // Load preferences from localStorage or use defaults
  const [preferences, setPreferences] = useState<PreferencesData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`preferences_${user.id}`);
      if (saved) {
        try {
          return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
        } catch (e) {
          logger.error('Failed to parse saved preferences:', e);
        }
      }
    }
    return DEFAULT_PREFERENCES;
  });

  // Auto-save hook for all preferences
  const autoSave = useAutoSave({
    data: preferences,
    onSave: async (data: PreferencesData) => {
      // Save to localStorage (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`preferences_${user.id}`, JSON.stringify(data));
      }
      // Simulate small delay to show save indicator
      await new Promise(resolve => setTimeout(resolve, 100));
    },
    enabled: !isLoading, // Only enable after initial load
    debounceMs: 0, // Immediate save for selects and toggles
  });

  // Get available timezones
  const timezones = Intl.supportedValuesOf('timeZone').map(tz => ({
    value: tz,
    label: tz.replace(/_/g, ' '),
  }));

  // Check for notification support
  useEffect(() => {
    setSupportsNotifications('Notification' in window);
    setIsLoading(false);
  }, []);

  // Update a preference value
  const updatePreference = <K extends keyof PreferencesData>(key: K, value: PreferencesData[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  // Update nested email notification preferences
  const updateEmailNotification = (
    key: keyof PreferencesData['emailNotifications'],
    value: boolean
  ) => {
    setPreferences(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value,
      },
    }));
    setError(null);
  };

  // Request desktop notification permission
  const requestNotificationPermission = async () => {
    if (!supportsNotifications) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updatePreference('desktopNotifications', true);
        // Show test notification
        new Notification('Notifications Enabled', {
          body: 'You will now receive desktop notifications from Veritable Games.',
          icon: '/favicon.ico',
        });
      } else {
        setError('Desktop notification permission was denied.');
        updatePreference('desktopNotifications', false);
      }
    } catch (err) {
      logger.error('Failed to request notification permission:', err);
      setError('Failed to enable desktop notifications.');
    }
  };

  // Format date preview
  const formatDatePreview = (format: string) => {
    const date = new Date();
    switch (format) {
      case 'MM/DD/YYYY':
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      case 'DD/MM/YYYY':
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      case 'YYYY-MM-DD':
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      default:
        return '';
    }
  };

  // Format time preview
  const formatTimePreview = (format: '12' | '24') => {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (format === '12') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${period}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto-Save Status Indicator */}
      <div className="flex items-center justify-end">
        <AutoSaveIndicator
          status={autoSave.status}
          error={autoSave.error}
          lastSaved={autoSave.lastSaved}
        />
      </div>

      {/* Error Display */}
      {(error || autoSave.status === 'error') && (
        <SettingsErrorDisplay error={error || autoSave.error || 'Failed to save preferences'} />
      )}

      {/* Time & Date Preferences */}
      <SettingsSection
        title="Time & Date"
        description="Configure how dates and times are displayed"
      >
        <div className="space-y-4">
          <SettingsSelect
            label="Timezone"
            value={preferences.timezone}
            onChange={e => updatePreference('timezone', e.target.value)}
            options={timezones}
            helperText="Your current timezone for displaying times"
          />

          <SettingsSelect
            label="Date Format"
            value={preferences.dateFormat}
            onChange={e =>
              updatePreference('dateFormat', e.target.value as PreferencesData['dateFormat'])
            }
            options={[
              { value: 'MM/DD/YYYY', label: `MM/DD/YYYY (${formatDatePreview('MM/DD/YYYY')})` },
              { value: 'DD/MM/YYYY', label: `DD/MM/YYYY (${formatDatePreview('DD/MM/YYYY')})` },
              { value: 'YYYY-MM-DD', label: `YYYY-MM-DD (${formatDatePreview('YYYY-MM-DD')})` },
            ]}
            helperText="How dates should be formatted"
          />

          <SettingsSelect
            label="Time Format"
            value={preferences.timeFormat}
            onChange={e => updatePreference('timeFormat', e.target.value as '12' | '24')}
            options={[
              { value: '12', label: `12-hour (${formatTimePreview('12')})` },
              { value: '24', label: `24-hour (${formatTimePreview('24')})` },
            ]}
            helperText="12-hour or 24-hour time format"
          />
        </div>
      </SettingsSection>

      {/* Notification Preferences */}
      <SettingsSection title="Notifications" description="Manage how you receive notifications">
        <div className="space-y-4">
          <SettingsToggleGroup
            label="Email Notifications"
            description="Choose which events trigger email notifications"
            options={[
              {
                id: 'newMessages',
                label: 'New Messages',
                description: 'Receive emails for new private messages',
                checked: preferences.emailNotifications.newMessages,
              },
              {
                id: 'mentions',
                label: 'Mentions',
                description: 'Notifications when someone mentions you',
                checked: preferences.emailNotifications.mentions,
              },
            ]}
            onChange={(id, checked) =>
              updateEmailNotification(id as keyof PreferencesData['emailNotifications'], checked)
            }
            showDividers={false}
          />

          {supportsNotifications && (
            <div className="space-y-2">
              <SettingsToggle
                label="Desktop Notifications"
                description="Show browser notifications for important events"
                checked={preferences.desktopNotifications}
                onChange={checked => {
                  if (checked && Notification.permission !== 'granted') {
                    requestNotificationPermission();
                  } else {
                    updatePreference('desktopNotifications', checked);
                  }
                }}
              />
              {Notification.permission === 'denied' && (
                <p className="ml-4 text-xs text-yellow-500">
                  Desktop notifications are blocked. Please enable them in your browser settings.
                </p>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      <p className="text-sm text-gray-500">
        All preference changes are saved automatically to your browser.
      </p>
    </div>
  );
}
