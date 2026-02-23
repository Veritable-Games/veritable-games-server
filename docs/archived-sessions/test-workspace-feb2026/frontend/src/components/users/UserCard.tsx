'use client';

import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import { User as UserType } from '@/lib/users/types';
import { User, MessageSquare } from 'lucide-react';
import { getProfileUrlFromUsername, getConversationUrlFromUsername } from '@/lib/utils/profile-url';

interface UserCardProps {
  user: UserType;
  isSelected?: boolean;
  isAdmin?: boolean;
  onClick?: (user: UserType, event: React.MouseEvent) => void;
}

export default function UserCard({ user, isSelected, isAdmin, onClick }: UserCardProps) {
  const handleClick = (event: React.MouseEvent) => {
    if (onClick) {
      onClick(user, event);
    }
  };

  // Status indicators based on ban_type field
  const isSoftBanned = user.ban_type === 'soft';
  const isHardBanned = user.ban_type === 'hard';

  return (
    <div
      onClick={handleClick}
      className={`rounded-lg border bg-gray-900/30 p-4 transition-all ${isSelected ? 'border-l-4 border-blue-500 bg-blue-900/20' : 'border-gray-700'} ${isAdmin ? 'cursor-pointer hover:bg-gray-900/50' : 'hover:bg-gray-900/50'} `}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar user={user} size="md" clickable={true} />
        </div>

        {/* User Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center space-x-2">
            <Link
              href={getProfileUrlFromUsername(user.username)}
              className="truncate font-medium text-white transition-colors hover:text-blue-400"
              onClick={e => e.stopPropagation()}
            >
              {user.display_name || user.username}
            </Link>

            {/* Role badge */}
            {user.role && user.role !== 'user' && (
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  user.role === 'admin'
                    ? 'bg-red-900/30 text-red-400'
                    : user.role === 'developer'
                      ? 'bg-purple-900/30 text-purple-400'
                      : 'bg-blue-900/30 text-blue-400'
                }`}
              >
                {user.role}
              </span>
            )}

            {/* Ban status indicators */}
            {isSoftBanned && (
              <span
                className="flex items-center space-x-1 rounded bg-orange-900/30 px-2 py-0.5 text-xs text-orange-400"
                title="Soft Banned"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              </span>
            )}

            {isHardBanned && (
              <span
                className="flex items-center space-x-1 rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400"
                title="Hard Banned"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </span>
            )}
          </div>

          {user.username !== (user.display_name || user.username) && (
            <p className="mb-2 text-sm text-gray-400">@{user.username}</p>
          )}

          {user.bio && <p className="mb-2 line-clamp-2 text-sm text-gray-300">{user.bio}</p>}

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Joined{' '}
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex space-x-2">
        <Link
          href={getProfileUrlFromUsername(user.username)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
          onClick={e => e.stopPropagation()}
        >
          <User size={16} className="flex-shrink-0" />
          <span className="hidden sm:inline">View Profile</span>
          <span className="sm:hidden">Profile</span>
        </Link>
        <Link
          href={getConversationUrlFromUsername(user.username)}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
          onClick={e => e.stopPropagation()}
        >
          <MessageSquare size={16} className="flex-shrink-0" />
          <span>Message</span>
        </Link>
      </div>
    </div>
  );
}
