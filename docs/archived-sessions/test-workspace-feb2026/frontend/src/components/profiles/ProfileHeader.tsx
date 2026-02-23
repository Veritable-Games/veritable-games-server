'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import { getConversationUrlFromUsername } from '@/lib/utils/profile-url';
import BadgeDisplay, { BadgeWithLabel } from '@/components/badges/BadgeDisplay';
import type { BadgeDisplay as BadgeDisplayType } from '@/lib/badges/types';
import ProfileAdminPanel from './ProfileAdminPanel';
import type { User } from '@/lib/users/types';

interface AdaptedUser {
  id: number;
  username: string;
  displayName?: string;
  bio?: string;
  location?: string;
  role: string;
  isActive: boolean;
  lastActive?: string; // Timestamp of last activity - used for online status
  avatarUrl?: string;
  avatarPosition?: {
    x: number;
    y: number;
    scale: number;
  };
  websiteUrl?: string;
  githubUrl?: string;
  mastodonUrl?: string;
  discordUsername?: string;
  steamUrl?: string;
  xboxGamertag?: string;
  psnId?: string;
  blueskyUrl?: string;
}

interface ProfileHeaderProps {
  user: AdaptedUser;
  originalUser: any; // For Avatar component
  isOwnProfile: boolean;
  joinDate: string;
  lastActiveDate: string;
  badges?: BadgeDisplayType[];
  isAdmin?: boolean;
  onRoleChange?: (userId: number, newRole: User['role']) => void;
  onBadgeChange?: () => void;
}

export const ProfileHeader = memo<ProfileHeaderProps>(
  ({
    user,
    originalUser,
    isOwnProfile,
    joinDate,
    lastActiveDate,
    badges = [],
    isAdmin = false,
    onRoleChange,
    onBadgeChange,
  }) => {
    const [currentRole, setCurrentRole] = useState<User['role']>(user.role as User['role']);

    // Handle role change and update local state
    const handleRoleChange = (userId: number, newRole: User['role']) => {
      setCurrentRole(newRole);
      onRoleChange?.(userId, newRole);
    };

    // Show admin controls only for admins viewing other users' profiles
    const showAdminControls = isAdmin && !isOwnProfile;

    // Convert avatarPosition to the format Avatar component expects
    const avatarUser = {
      ...originalUser,
      avatar_url: originalUser.avatarUrl,
      avatar_position_x: originalUser.avatarPosition?.x ?? 50,
      avatar_position_y: originalUser.avatarPosition?.y ?? 50,
      avatar_scale: originalUser.avatarPosition?.scale ?? 100,
      display_name: originalUser.displayName,
    };

    const getRoleBadgeStyles = (role: string) => {
      switch (role) {
        case 'admin':
          return 'bg-red-600/20 text-red-400 border-red-600/30';
        case 'developer':
          return 'bg-purple-600/20 text-purple-400 border-purple-600/30';
        case 'moderator':
          return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
        default:
          return 'bg-gray-700/50 text-gray-400 border-gray-600/30';
      }
    };

    return (
      <div className="mb-6 flex-shrink-0">
        {/* Back Navigation */}
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Back to Home
        </Link>

        {/* Main Profile Card - matching site styling */}
        <div className="rounded-lg border border-gray-700 bg-gray-900/70">
          {/* Profile Content Section */}
          <div className="p-6">
            <div className="flex items-start space-x-6">
              {/* Avatar Section */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <Avatar user={avatarUser} size="xl" clickable={false} />
                  {/* Online Status Indicator - based on last activity time */}
                  {(() => {
                    // Calculate online status from lastActive timestamp
                    const ONLINE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
                    const AWAY_THRESHOLD = 60 * 60 * 1000; // 1 hour
                    const lastActiveTime = user.lastActive
                      ? new Date(user.lastActive).getTime()
                      : 0;
                    const timeSinceActive = Date.now() - lastActiveTime;

                    // Don't show indicator if account is banned (isActive = false)
                    if (!user.isActive) {
                      return (
                        <div
                          className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-gray-900 bg-gray-500"
                          title="Account suspended"
                        />
                      );
                    }

                    // Online: active within 15 minutes
                    if (lastActiveTime > 0 && timeSinceActive < ONLINE_THRESHOLD) {
                      return (
                        <div
                          className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-gray-900 bg-green-500"
                          title="Online"
                        />
                      );
                    }

                    // Away: active within 1 hour
                    if (lastActiveTime > 0 && timeSinceActive < AWAY_THRESHOLD) {
                      return (
                        <div
                          className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-gray-900 bg-yellow-500"
                          title="Away"
                        />
                      );
                    }

                    // Offline: no recent activity
                    return (
                      <div
                        className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-gray-900 bg-gray-500"
                        title="Offline"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* User Info Section */}
              <div className="min-w-0 flex-1">
                {/* Name and Username */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">
                      {user.displayName || user.username}
                    </h1>
                    {/* Role Badge - inline with username (static display) */}
                    <span
                      className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeStyles(currentRole)} `}
                    >
                      {currentRole.toUpperCase()}
                    </span>
                    {/* Supporter/Achievement Badges - inline with username */}
                    {badges.length > 0 && <BadgeDisplay badges={badges} maxDisplay={3} size="md" />}
                  </div>
                  {user.username !== user.displayName && (
                    <p className="text-sm text-gray-400">@{user.username}</p>
                  )}
                </div>

                {/* Bio */}
                {user.bio && <p className="mb-4 leading-relaxed text-gray-300">{user.bio}</p>}

                {/* Meta Information */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
                  {user.location && (
                    <div className="flex items-center">
                      <svg
                        className="mr-1.5 h-4 w-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {user.location}
                    </div>
                  )}
                  <div className="flex items-center">
                    <svg
                      className="mr-1.5 h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Joined {joinDate}
                  </div>
                  <div className="flex items-center">
                    <svg
                      className="mr-1.5 h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Active {lastActiveDate}
                  </div>
                </div>

                {/* Full Badges Section - show all badges with labels */}
                {badges.length > 0 && (
                  <div className="mt-4 border-t border-gray-700/50 pt-4">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      Badges
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {badges.map(badge => (
                        <BadgeWithLabel key={badge.id} badge={badge} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar - separated with border */}
          <div className="border-t border-gray-700 bg-gray-900/50 px-6 py-4">
            <div className="flex items-center justify-between">
              {!isOwnProfile ? (
                <Link
                  href={getConversationUrlFromUsername(user.username)}
                  className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  Send Message
                </Link>
              ) : (
                <>
                  <div className="flex gap-3">
                    <Link
                      href="/messages"
                      className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                      Inbox
                    </Link>
                    <Link
                      href="/settings"
                      className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Settings
                    </Link>
                  </div>
                  <Link
                    href="/donate"
                    className="inline-flex items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-blue-400 transition-colors hover:bg-gray-700 hover:text-blue-300"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    Donations
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admin Panel - below the main card */}
        {showAdminControls && (
          <div className="mt-4">
            <ProfileAdminPanel
              userId={user.id}
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              onBadgeChange={onBadgeChange}
            />
          </div>
        )}
      </div>
    );
  }
);

ProfileHeader.displayName = 'ProfileHeader';
