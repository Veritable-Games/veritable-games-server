'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/users/types';
import { fetchJSON } from '@/lib/utils/csrf';
import {
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
  SettingsErrorDisplay,
  AutoSaveIndicator,
} from '@/components/settings/ui';
import { useAutoSave } from '@/hooks/useAutoSave';
import { logger } from '@/lib/utils/logger';

interface PrivacyFormData {
  profile_visibility: 'public' | 'members' | 'private';
  activity_visibility: 'public' | 'members' | 'private';
  email_visibility: 'public' | 'members' | 'admin' | 'private';
  show_online_status: boolean;
  show_last_active: boolean;
  allow_messages: boolean;
  show_reputation_details: boolean;
  show_forum_activity: boolean;
  show_wiki_activity: boolean;
  show_messaging_activity: boolean;
}

interface PrivacySettingsFormProps {
  user: User;
}

export function PrivacySettingsForm({ user }: PrivacySettingsFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PrivacyFormData>({
    profile_visibility: 'public',
    activity_visibility: 'public',
    email_visibility: 'private',
    show_online_status: true,
    show_last_active: true,
    allow_messages: true,
    show_reputation_details: true,
    show_forum_activity: true,
    show_wiki_activity: true,
    show_messaging_activity: true,
  });

  // Auto-save hook for all privacy changes
  const autoSave = useAutoSave({
    data: formData,
    onSave: async (data: PrivacyFormData) => {
      await fetchJSON(`/api/users/${user.id}/privacy`, {
        method: 'PUT',
        body: data,
      });
    },
    enabled: !isLoading, // Only enable after initial load
    debounceMs: 300, // Debounce for dropdowns
  });

  // Fetch current privacy settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const privacyResponse = await fetch(`/api/users/${user.id}/privacy`, {
          credentials: 'include',
        });
        if (privacyResponse.ok) {
          const privacyData = await privacyResponse.json();
          const loadedData: PrivacyFormData = {
            profile_visibility: privacyData.data?.profile_visibility ?? 'public',
            activity_visibility: privacyData.data?.activity_visibility ?? 'public',
            email_visibility: privacyData.data?.email_visibility ?? 'private',
            show_online_status: privacyData.data?.show_online_status ?? true,
            show_last_active: privacyData.data?.show_last_active ?? true,
            allow_messages: privacyData.data?.allow_messages ?? true,
            show_reputation_details: privacyData.data?.show_reputation_details ?? true,
            show_forum_activity: privacyData.data?.show_forum_activity ?? true,
            show_wiki_activity: privacyData.data?.show_wiki_activity ?? true,
            show_messaging_activity: privacyData.data?.show_messaging_activity ?? true,
          };
          setFormData(loadedData);
        }
      } catch (error) {
        logger.error('Failed to fetch privacy settings:', error);
        setError('Failed to load privacy settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  const handleChange = (field: keyof PrivacyFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Visibility Settings Section Skeleton */}
        <SettingsSection title="Visibility Settings">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-4 w-32 rounded bg-gray-700"></div>
                <div className="h-10 w-full rounded bg-gray-700"></div>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Display Options Section Skeleton */}
        <SettingsSection title="Display Options">
          <div className="animate-pulse space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <div className="mb-1 h-4 w-40 rounded bg-gray-700"></div>
                  <div className="h-3 w-64 rounded bg-gray-700"></div>
                </div>
                <div className="h-6 w-11 rounded-full bg-gray-700"></div>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>
    );
  }

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
        <SettingsErrorDisplay error={error || autoSave.error || 'Failed to save settings'} />
      )}

      {/* Visibility Settings */}
      <SettingsSection title="Visibility Settings">
        <div className="space-y-4">
          <SettingsSelect
            label="Profile Visibility"
            value={formData.profile_visibility}
            onChange={e => handleChange('profile_visibility', e.target.value)}
            options={[
              { value: 'public', label: 'Public - Anyone can view' },
              { value: 'members', label: 'Members Only - Registered users only' },
              { value: 'private', label: 'Private - Only you can view' },
            ]}
            helperText="Control who can view your profile page"
          />

          <SettingsSelect
            label="Activity Visibility"
            value={formData.activity_visibility}
            onChange={e => handleChange('activity_visibility', e.target.value)}
            options={[
              { value: 'public', label: 'Public - Anyone can view' },
              { value: 'members', label: 'Members Only - Registered users only' },
              { value: 'private', label: 'Private - Only you can view' },
            ]}
            helperText="Control who can see your activity feed and contributions"
          />

          <SettingsSelect
            label="Email Visibility"
            value={formData.email_visibility}
            onChange={e => handleChange('email_visibility', e.target.value)}
            options={[
              { value: 'public', label: 'Public - Anyone can view' },
              { value: 'members', label: 'Members Only - Registered users only' },
              { value: 'admin', label: 'Admins Only - Only site administrators' },
              { value: 'private', label: 'Private - Only you can view' },
            ]}
            helperText="Control who can see your email address"
          />
        </div>
      </SettingsSection>

      {/* Display Options */}
      <SettingsSection title="Display Options">
        <div className="space-y-4">
          <SettingsToggle
            label="Show Online Status"
            description="Let others see when you're online"
            checked={formData.show_online_status}
            onChange={checked => handleChange('show_online_status', checked)}
          />

          <SettingsToggle
            label="Show Last Active Time"
            description="Display when you were last active"
            checked={formData.show_last_active}
            onChange={checked => handleChange('show_last_active', checked)}
          />

          <SettingsToggle
            label="Allow Direct Messages"
            description="Allow other users to send you messages"
            checked={formData.allow_messages}
            onChange={checked => handleChange('allow_messages', checked)}
          />

          <SettingsToggle
            label="Show Reputation Details"
            description="Display your reputation score and badges on your profile"
            checked={formData.show_reputation_details}
            onChange={checked => handleChange('show_reputation_details', checked)}
          />

          <SettingsToggle
            label="Show Forum Activity"
            description="Display your forum posts and topics on your profile"
            checked={formData.show_forum_activity}
            onChange={checked => handleChange('show_forum_activity', checked)}
          />

          <SettingsToggle
            label="Show Wiki Activity"
            description="Display your wiki contributions on your profile"
            checked={formData.show_wiki_activity}
            onChange={checked => handleChange('show_wiki_activity', checked)}
          />

          <SettingsToggle
            label="Show Messaging Activity"
            description="Display your messaging activity and status on your profile"
            checked={formData.show_messaging_activity}
            onChange={checked => handleChange('show_messaging_activity', checked)}
          />
        </div>
      </SettingsSection>

      <p className="text-sm text-gray-500">
        Changes are saved automatically. Update any setting to change your privacy preferences.
      </p>
    </div>
  );
}
