'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { User } from '@/lib/auth/utils';
import { getProfileUrlFromUsername } from '@/lib/utils/profile-url';

interface AvatarProps {
  user: User | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  clickable?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

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

function getGradientForUser(userId?: number | string): string {
  if (!userId) return gradients[0] || '';
  // Always convert to number to ensure consistent gradient across all views
  const numericId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (isNaN(numericId)) return gradients[0] || '';
  const index = numericId % gradients.length;
  return gradients[index] || gradients[0] || '';
}

function Avatar({ user, size = 'md', className = '', clickable = true }: AvatarProps) {
  const displayName = user?.display_name || user?.username || 'Unknown User';
  const initial = displayName.charAt(0).toUpperCase();
  const gradient = getGradientForUser(user?.id);
  const avatarUrl = user?.avatar_url;
  const positionX = user?.avatar_position_x ?? 50;
  const positionY = user?.avatar_position_y ?? 50;
  const scale = user?.avatar_scale ?? 100;

  // Memoize style objects to prevent re-creation on every render
  const containerStyle = useMemo(
    () => ({
      transform: `scale(${scale / 100})`,
      transformOrigin: 'center',
    }),
    [scale]
  );

  const imageStyle = useMemo(
    () => ({
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
      maxWidth: 'none',
      width: '100%',
      height: 'auto',
    }),
    [positionX, positionY]
  );

  // Create avatar content with hover and click styles
  const isClickableWithId = clickable && user?.id;
  const baseClasses = `
    ${sizeClasses[size]} 
    rounded-full overflow-hidden shadow-lg relative
    ${isClickableWithId ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200' : ''}
    ${className}
  `;

  // If user has an avatar URL, show the image
  if (avatarUrl) {
    const avatarContent = (
      <div
        data-testid="avatar-container"
        className={baseClasses}
        title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
      >
        <div className="absolute inset-0 flex items-center justify-center" style={containerStyle}>
          <img
            src={avatarUrl}
            alt={displayName}
            className="absolute"
            style={imageStyle}
            loading="lazy"
            decoding="async"
            onError={e => {
              // If image fails to load, hide it and show the fallback gradient
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>
    );

    if (isClickableWithId && user?.username) {
      return (
        <Link href={getProfileUrlFromUsername(user.username)} className="inline-block">
          {avatarContent}
        </Link>
      );
    }

    return avatarContent;
  }

  // Otherwise show the gradient with initial
  const gradientClasses = `
    ${sizeClasses[size]}
    bg-gradient-to-br ${gradient}
    rounded-full flex items-center justify-center
    text-white font-semibold shadow-lg
    ${isClickableWithId ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200' : ''}
    ${className}
  `;

  const gradientContent = (
    <div
      data-testid="avatar-container"
      className={gradientClasses}
      title={`${displayName}${isClickableWithId ? ' - Click to view profile' : ''}`}
    >
      {initial}
    </div>
  );

  if (isClickableWithId && user?.username) {
    return (
      <Link href={getProfileUrlFromUsername(user.username)} className="inline-block">
        {gradientContent}
      </Link>
    );
  }

  return gradientContent;
}

// Memoize the component to prevent unnecessary re-renders
export default memo(Avatar, (prevProps, nextProps) => {
  // Custom comparison function for memo
  const prevUser = prevProps.user;
  const nextUser = nextProps.user;

  return (
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className &&
    prevProps.clickable === nextProps.clickable &&
    prevUser?.id === nextUser?.id &&
    prevUser?.avatar_url === nextUser?.avatar_url &&
    prevUser?.avatar_position_x === nextUser?.avatar_position_x &&
    prevUser?.avatar_position_y === nextUser?.avatar_position_y &&
    prevUser?.avatar_scale === nextUser?.avatar_scale &&
    prevUser?.display_name === nextUser?.display_name &&
    prevUser?.username === nextUser?.username
  );
});
