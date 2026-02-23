'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getProfileUrlFromUsername } from '@/lib/utils/profile-url';
import { BadgeDisplayCompact } from '@/components/badges/BadgeDisplay';
import type { BadgeDisplay } from '@/lib/badges/types';
import { logger } from '@/lib/utils/logger';

interface UserLinkProps {
  userId?: number;
  username: string;
  displayName?: string;
  className?: string;
  showAvatar?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  showHoverCard?: boolean;
  disableLink?: boolean;
  badges?: BadgeDisplay[];
}

export function UserLink({
  userId,
  username,
  displayName,
  className = '',
  showAvatar = false,
  avatarSize = 'md',
  children,
  showHoverCard = true,
  disableLink = false,
  badges = [],
}: UserLinkProps) {
  const { user: currentUser } = useAuth();
  const displayText = displayName || username;

  // If no userId, render as plain text
  if (!userId) {
    return (
      <span className={className.includes('text-') ? className : `text-gray-400 ${className}`}>
        {children || displayText}
      </span>
    );
  }

  // Allow everyone to view profiles (public profiles)
  const canViewProfile = true;

  const avatarSizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const avatarClass = avatarSizeClasses[avatarSize];

  const badgeDisplay =
    badges.length > 0 ? <BadgeDisplayCompact badges={badges} maxDisplay={2} /> : null;

  const content =
    children ||
    (showAvatar ? (
      <div className="flex items-center space-x-2">
        <div
          className={`${avatarClass} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white`}
        >
          {displayText[0]?.toUpperCase() || 'U'}
        </div>
        <span>{displayText}</span>
        {badgeDisplay}
      </div>
    ) : (
      <span className="inline-flex items-center gap-1">
        {displayText}
        {badgeDisplay}
      </span>
    ));

  // If user can't view profile or link is disabled, render as plain text
  if (!canViewProfile || disableLink) {
    return (
      <span className={className.includes('text-') ? className : `text-gray-400 ${className}`}>
        {content}
      </span>
    );
  }

  const linkElement = (
    <Link
      href={getProfileUrlFromUsername(username)}
      className={`transition-colors hover:text-blue-400 ${className}`}
    >
      {content}
    </Link>
  );

  // Temporarily disable hover card to debug the "0" issue
  // if (showHoverCard && userId) {
  //   return (
  //     <AuthorHoverCard userId={userId} username={username}>
  //       {linkElement}
  //     </AuthorHoverCard>
  //   );
  // }

  return linkElement;
}

// Separate component for just clickable avatars
export function UserAvatar({
  userId,
  username,
  displayName,
  size = 'md',
  className = '',
  showUploadedAvatar = false,
}: {
  userId?: number;
  username: string;
  displayName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showUploadedAvatar?: boolean;
}) {
  const [userData, setUserData] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const displayText = displayName || username;

  // Fetch full user data if showUploadedAvatar is true
  useEffect(() => {
    let cancelled = false;

    const fetchUserData = () => {
      if (showUploadedAvatar && userId && !cancelled) {
        // Add timestamp to bypass cache when needed
        const cacheBuster = Date.now();
        fetch(`/api/users/${userId}?t=${cacheBuster}`)
          .then(res => {
            if (!cancelled) return res.json();
            throw new Error('Cancelled');
          })
          .then(data => {
            if (!cancelled && data.success && data.data) {
              setUserData(data.data);
            }
          })
          .catch(err => {
            // Silently fail - will use default avatar
            if (err.message !== 'Cancelled') {
              logger.debug('Avatar fetch failed:', err);
            }
          });
      }
    };

    // Initial fetch
    fetchUserData();

    // Listen for avatar updates (custom event)
    const handleAvatarUpdate = ((event: CustomEvent) => {
      if (event.detail.userId === userId) {
        // Refetch user data when avatar is updated
        fetchUserData();
      }
    }) as EventListener;

    window.addEventListener('avatar-updated', handleAvatarUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
    };
  }, [userId, showUploadedAvatar]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  // Generate gradient colors based on user ID for consistency
  const gradients = [
    'from-blue-500 to-purple-600',
    'from-green-500 to-blue-600',
    'from-purple-500 to-pink-600',
    'from-yellow-500 to-orange-600',
    'from-red-500 to-pink-600',
    'from-indigo-500 to-blue-600',
    'from-teal-500 to-green-600',
    'from-orange-500 to-red-600',
  ];

  const gradient = gradients[(userId || 0) % gradients.length];

  // Get avatar details from userData or use defaults
  const avatarUrl = userData?.avatar_url;
  const positionX = userData?.avatar_position_x ?? 50;
  const positionY = userData?.avatar_position_y ?? 50;
  const scale = userData?.avatar_scale ?? 100;

  const avatarContent = avatarUrl ? (
    <div
      className={`${sizeClasses[size]} relative overflow-hidden rounded-full ring-2 ring-gray-700 transition-all hover:ring-blue-500 ${className}`}
      title={displayText}
    >
      <div
        className="absolute inset-0 flex items-center justify-center bg-gray-800"
        style={{
          transform: `scale(${scale / 100})`,
          transformOrigin: 'center',
        }}
      >
        <img
          src={avatarUrl}
          alt={displayText}
          className="absolute h-full w-full object-cover"
          style={{
            left: `${positionX}%`,
            top: `${positionY}%`,
            transform: 'translate(-50%, -50%)',
            maxWidth: 'none',
            width: 'auto',
            height: 'auto',
            minWidth: '100%',
            minHeight: '100%',
          }}
          onError={e => {
            // If image fails to load, hide it
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    </div>
  ) : (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br ${gradient} flex items-center justify-center rounded-full font-bold text-white ring-2 ring-gray-700 transition-all hover:ring-blue-500 ${className}`}
      title={displayText}
    >
      {displayText?.[0]?.toUpperCase() || 'U'}
    </div>
  );

  if (!userId) {
    return avatarContent;
  }

  // Allow everyone to view profiles (public profiles)
  const canViewProfile = true;

  // If user can't view profile, render as non-clickable avatar
  if (!canViewProfile) {
    return avatarContent;
  }

  return (
    <Link
      href={getProfileUrlFromUsername(username)}
      className="transition-opacity hover:opacity-80"
    >
      {avatarContent}
    </Link>
  );
}
