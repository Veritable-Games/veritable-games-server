'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/users/types';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import Avatar from '@/components/ui/Avatar';
import { AvatarCropper } from '@/components/profiles/AvatarCropper';
import { fetchJSON } from '@/lib/utils/csrf';
import {
  SettingsSection,
  SettingsInput,
  SettingsSelect,
  SettingsButton,
  SettingsSaveButton,
  SettingsErrorDisplay,
  SettingsButtonGroup,
  AutoSaveIndicator,
} from '@/components/settings/ui';
import { useAutoSave } from '@/hooks/useAutoSave';
import { logger } from '@/lib/utils/logger';

interface ProfileSettingsFormProps {
  user: User;
}

interface ProfileFormData {
  display_name: string;
  bio: string;
  avatar_url: string;
  location: string;
  website_url: string;
  github_url: string;
  discord_username: string;
  steam_url: string;
  xbox_gamertag: string;
  psn_id: string;
  bluesky_url: string;
  avatar_position_x: number;
  avatar_position_y: number;
  avatar_scale: number;
}

interface VisibilityFormData {
  profile_visibility: 'public' | 'members' | 'private';
  activity_visibility: 'public' | 'members' | 'private';
  email_visibility: 'public' | 'members' | 'admin' | 'private';
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropper, setShowCropper] = useState(false);

  // Profile form data (manual save)
  const [formData, setFormData] = useState<ProfileFormData>({
    display_name: user.display_name || '',
    bio: user.bio || '',
    avatar_url: user.avatar_url || '',
    location: user.location || '',
    website_url: user.website_url || '',
    github_url: user.github_url || '',
    discord_username: user.discord_username || '',
    steam_url: user.steam_url || '',
    xbox_gamertag: user.xbox_gamertag || '',
    psn_id: user.psn_id || '',
    bluesky_url: user.bluesky_url || '',
    avatar_position_x: user.avatar_position_x ?? 50,
    avatar_position_y: user.avatar_position_y ?? 50,
    avatar_scale: user.avatar_scale ?? 100,
  });

  // Visibility settings (auto-save)
  const [visibilityData, setVisibilityData] = useState<VisibilityFormData>({
    profile_visibility: 'public',
    activity_visibility: 'public',
    email_visibility: 'private',
  });

  // Auto-save hook for visibility settings
  const autoSave = useAutoSave({
    data: visibilityData,
    onSave: async (data: VisibilityFormData) => {
      await fetchJSON(`/api/users/${user.id}/privacy`, {
        method: 'PUT',
        body: data,
      });
    },
    enabled: !isLoadingVisibility, // Only enable after initial load
    debounceMs: 0, // Immediate save for selects
  });

  // Fetch visibility settings on mount
  useEffect(() => {
    const fetchVisibilitySettings = async () => {
      try {
        const response = await fetch(`/api/users/${user.id}/privacy`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setVisibilityData({
            profile_visibility: data.profile_visibility || 'public',
            activity_visibility: data.activity_visibility || 'public',
            email_visibility: data.email_visibility || 'private',
          });
        }
      } catch (error) {
        logger.error('Failed to fetch visibility settings:', error);
      } finally {
        setIsLoadingVisibility(false);
      }
    };

    fetchVisibilitySettings();
  }, [user.id]);

  // Track initial values for change detection
  const initialValues = useMemo(
    () => ({
      display_name: user.display_name || '',
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
      location: user.location || '',
      website_url: user.website_url || '',
      github_url: user.github_url || '',
      discord_username: user.discord_username || '',
      steam_url: user.steam_url || '',
      xbox_gamertag: user.xbox_gamertag || '',
      psn_id: user.psn_id || '',
      bluesky_url: user.bluesky_url || '',
    }),
    [user]
  );

  // Check if form has changes (excluding avatar position which saves separately)
  const hasChanges = useMemo(() => {
    return (
      formData.display_name !== initialValues.display_name ||
      formData.bio !== initialValues.bio ||
      formData.avatar_url !== initialValues.avatar_url ||
      formData.location !== initialValues.location ||
      formData.website_url !== initialValues.website_url ||
      formData.github_url !== initialValues.github_url ||
      formData.discord_username !== initialValues.discord_username ||
      formData.steam_url !== initialValues.steam_url ||
      formData.xbox_gamertag !== initialValues.xbox_gamertag ||
      formData.psn_id !== initialValues.psn_id ||
      formData.bluesky_url !== initialValues.bluesky_url
    );
  }, [formData, initialValues]);

  // CSRF protection has been removed from this application

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleBioChange = (content: string) => {
    setFormData(prev => ({ ...prev, bio: content }));
    setError(null);
  };

  const handleVisibilityChange = <K extends keyof VisibilityFormData>(
    field: K,
    value: VisibilityFormData[K]
  ) => {
    setVisibilityData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.append('avatar', file);

      const data = await fetchJSON(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        body: uploadData,
      });

      // Update form data with new avatar URL and reset position
      handleInputChange('avatar_url', data.data.avatar_url);
      setFormData(prev => ({
        ...prev,
        avatar_url: data.data.avatar_url,
        avatar_position_x: 50,
        avatar_position_y: 50,
        avatar_scale: 100,
      }));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logger.error('Avatar upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCropperSave = async (x: number, y: number, scale: number) => {
    try {
      // Update local form state
      setFormData(prev => ({
        ...prev,
        avatar_position_x: x,
        avatar_position_y: y,
        avatar_scale: scale,
      }));

      await fetchJSON(`/api/users/${user.id}`, {
        method: 'PUT',
        body: {
          avatar_position_x: x,
          avatar_position_y: y,
          avatar_scale: scale,
        },
      });

      setShowCropper(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logger.error('Error saving avatar position:', err);
      setError(err instanceof Error ? err.message : 'Failed to save avatar position');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await fetchJSON(`/api/users/${user.id}`, {
        method: 'PUT',
        body: {
          display_name: formData.display_name || null,
          bio: formData.bio || null,
          avatar_url: formData.avatar_url || null,
          location: formData.location || null,
          website_url: formData.website_url || null,
          github_url: formData.github_url || null,
          discord_username: formData.discord_username || null,
          steam_url: formData.steam_url || null,
          xbox_gamertag: formData.xbox_gamertag || null,
          psn_id: formData.psn_id || null,
          bluesky_url: formData.bluesky_url || null,
        },
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // CRITICAL: Refresh to get updated session data from auth.db
      // This ensures the form shows saved values after page refresh
      router.refresh();
    } catch (err) {
      logger.error('Profile update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine save button state
  const getSaveState = () => {
    if (isLoading) return 'saving';
    if (success) return 'saved';
    if (error) return 'error';
    return 'idle';
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Error and Success Messages */}
      <SettingsErrorDisplay
        error={error}
        success={success ? 'Profile updated successfully!' : null}
        onDismissError={() => setError(null)}
        onDismissSuccess={() => setSuccess(false)}
      />

      {/* Avatar Section */}
      <SettingsSection title="Avatar" description="Upload and customize your profile picture">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="group relative">
              <Avatar
                user={{
                  ...user,
                  avatar_url: formData.avatar_url,
                  avatar_position_x: formData.avatar_position_x,
                  avatar_position_y: formData.avatar_position_y,
                  avatar_scale: formData.avatar_scale,
                  reputation: user.reputation || 0,
                  post_count: user.post_count || 0,
                  is_active: user.is_active !== undefined ? user.is_active : true,
                  last_active: user.last_active || new Date().toISOString(),
                }}
                size="xl"
              />
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar || isLoading}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className={`absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-black/70 opacity-0 transition-all duration-200 group-hover:opacity-100 ${
                  uploadingAvatar || isLoading ? 'cursor-not-allowed' : ''
                }`}
              >
                {uploadingAvatar ? (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-8 w-8 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mx-auto mb-1 h-8 w-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-xs font-medium text-white">Upload</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex-1">
            <h4 className="mb-2 text-sm font-medium text-gray-200">Avatar Settings</h4>
            <p className="mb-4 text-sm text-gray-400">
              Click on your avatar to upload a new image (JPG, PNG, GIF, or WebP, max 5MB).
            </p>

            {formData.avatar_url ? (
              <div className="space-y-3">
                <SettingsButtonGroup spacing="sm">
                  <SettingsButton
                    type="button"
                    onClick={() => setShowCropper(true)}
                    variant="primary"
                    buttonSize="sm"
                    leftIcon={
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                    }
                  >
                    Adjust Position
                  </SettingsButton>
                  <SettingsButton
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        avatar_url: '',
                        avatar_position_x: 50,
                        avatar_position_y: 50,
                        avatar_scale: 100,
                      }));
                    }}
                    variant="secondary"
                    buttonSize="sm"
                    leftIcon={
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    }
                  >
                    Remove
                  </SettingsButton>
                </SettingsButtonGroup>
                <p className="text-xs text-gray-500">
                  Use "Adjust Position" to reposition and zoom your avatar after uploading.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Upload an avatar to access positioning controls.
              </p>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Basic Information */}
      <SettingsSection title="Basic Information" description="Your public profile information">
        <div className="space-y-4">
          <SettingsInput
            label="Display Name"
            placeholder="How you want to be known in the community"
            value={formData.display_name}
            onChange={e => handleInputChange('display_name', e.target.value)}
            disabled={isLoading}
            helperText={`Leave empty to use your username (${user.username})`}
          />

          <SettingsInput
            label="Location"
            placeholder="City, State/Country"
            value={formData.location}
            onChange={e => handleInputChange('location', e.target.value)}
            disabled={isLoading}
          />
        </div>
      </SettingsSection>

      {/* Bio Section */}
      <SettingsSection
        title="Bio"
        description="Tell the community about yourself. You can use Markdown formatting."
      >
        <MarkdownEditor
          initialContent={formData.bio}
          onChange={handleBioChange}
          placeholder="Write something about yourself, your interests, expertise, or what brings you to the community..."
          height="200px"
          showPreview={true}
          showToolbar={true}
          className="w-full max-w-full rounded border border-gray-600"
        />
      </SettingsSection>

      {/* Social Links */}
      <SettingsSection title="Social Links" description="Connect your social media profiles">
        <div className="space-y-4">
          <SettingsInput
            label="Website"
            placeholder="https://yourwebsite.com"
            value={formData.website_url}
            onChange={e => handleInputChange('website_url', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="GitHub"
            placeholder="https://github.com/yourusername"
            value={formData.github_url}
            onChange={e => handleInputChange('github_url', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="Bluesky"
            placeholder="https://bsky.app/profile/yourusername.bsky.social"
            value={formData.bluesky_url}
            onChange={e => handleInputChange('bluesky_url', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="Steam"
            placeholder="https://steamcommunity.com/id/yourusername"
            value={formData.steam_url}
            onChange={e => handleInputChange('steam_url', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="Xbox Gamertag"
            placeholder="YourGamertag"
            value={formData.xbox_gamertag}
            onChange={e => handleInputChange('xbox_gamertag', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="PlayStation Network ID"
            placeholder="YourPSNID"
            value={formData.psn_id}
            onChange={e => handleInputChange('psn_id', e.target.value)}
            disabled={isLoading}
          />

          <SettingsInput
            label="Discord Username"
            placeholder="username#1234"
            value={formData.discord_username}
            onChange={e => handleInputChange('discord_username', e.target.value)}
            disabled={isLoading}
          />
        </div>
      </SettingsSection>

      {/* Appearance & Visibility */}
      <SettingsSection
        title="Appearance & Visibility"
        description="Control who can see your profile and activity"
      >
        {/* Auto-Save Status Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Visibility Settings</h3>
          <AutoSaveIndicator
            status={autoSave.status}
            error={autoSave.error}
            lastSaved={autoSave.lastSaved}
          />
        </div>

        {isLoadingVisibility ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="mb-2 h-4 w-48 rounded bg-gray-700"></div>
                <div className="h-11 w-full rounded bg-gray-700"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <SettingsSelect
              label="Who can view your profile"
              value={visibilityData.profile_visibility}
              onChange={e =>
                handleVisibilityChange(
                  'profile_visibility',
                  e.target.value as 'public' | 'members' | 'private'
                )
              }
              options={[
                { value: 'public', label: 'Public - Anyone can view' },
                { value: 'members', label: 'Members Only - Registered users can view' },
                { value: 'private', label: 'Private - Only you can view' },
              ]}
            />

            <SettingsSelect
              label="Who can see your activity"
              value={visibilityData.activity_visibility}
              onChange={e =>
                handleVisibilityChange(
                  'activity_visibility',
                  e.target.value as 'public' | 'members' | 'private'
                )
              }
              options={[
                { value: 'public', label: 'Public - Anyone can see your activity' },
                {
                  value: 'members',
                  label: 'Members Only - Registered users can see activity',
                },
                { value: 'private', label: 'Private - Hide your activity' },
              ]}
            />

            <SettingsSelect
              label="Email address visibility"
              value={visibilityData.email_visibility}
              onChange={e =>
                handleVisibilityChange(
                  'email_visibility',
                  e.target.value as 'public' | 'members' | 'admin' | 'private'
                )
              }
              options={[
                { value: 'private', label: 'Private - Hide email address' },
                { value: 'admin', label: 'Admin Only - Only admins can see email' },
                {
                  value: 'members',
                  label: 'Members Only - Registered users can see email',
                },
                { value: 'public', label: 'Public - Anyone can see email' },
              ]}
            />

            <p className="text-sm text-gray-500">Visibility changes are saved automatically.</p>
          </div>
        )}
      </SettingsSection>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t border-gray-700/50 pt-6">
        <div className="text-sm text-gray-400">
          {hasChanges
            ? 'You have unsaved changes.'
            : 'Your changes will be visible immediately after saving.'}
        </div>
        <SettingsSaveButton
          type="submit"
          disabled={isLoading || !hasChanges}
          saveState={getSaveState()}
          text={{
            idle: hasChanges ? 'Save Changes' : 'No Changes',
            saving: 'Saving Changes...',
            saved: 'Changes Saved!',
            error: 'Save Failed',
          }}
        />
      </div>

      {/* Avatar Cropper Modal */}
      {showCropper && formData.avatar_url && (
        <AvatarCropper
          imageUrl={formData.avatar_url}
          initialX={formData.avatar_position_x}
          initialY={formData.avatar_position_y}
          initialScale={formData.avatar_scale}
          onSave={handleCropperSave}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </form>
  );
}
