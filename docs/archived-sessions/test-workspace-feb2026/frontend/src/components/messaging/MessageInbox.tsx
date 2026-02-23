'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getConversationUrlFromUsername } from '@/lib/utils/profile-url';
import { logger } from '@/lib/utils/logger';

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  last_seen?: string;
}

interface Conversation {
  conversation_id: number;
  other_user: User;
  last_message_preview?: string;
  last_message_time?: string;
  unread_count: number;
  is_last_message_from_me: boolean;
  is_archived: boolean;
  last_activity: string;
  // Fallback flat fields (some API endpoints may return these instead of nested other_user)
  other_username?: string;
  other_display_name?: string;
}

interface InboxData {
  conversations: Conversation[];
  pagination: {
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
  unreadCount: number;
  filter: string;
}

export default function MessageInbox() {
  const { user } = useAuth();
  const [inboxData, setInboxData] = useState<InboxData | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const response = await fetch(`/api/messages/inbox?filter=${activeFilter}&limit=20`);

      if (!response.ok) {
        setError(`HTTP error! status: ${response.status}`);
        return;
      }

      const result = await response.json();

      if (result?.success && result?.data) {
        setInboxData(result.data);
      } else {
        setError(result?.error || 'Failed to load messages');
      }
    } catch (err) {
      logger.error('Error fetching inbox:', err);
      setError('Network error loading messages');
    }
  }, [user, activeFilter]);

  useEffect(() => {
    let mounted = true;

    if (user) {
      fetchInbox().catch(error => {
        if (mounted) {
          logger.error('Error fetching inbox:', error);
        }
      });
    }

    return () => {
      mounted = false;
    };
  }, [user, activeFilter, fetchInbox]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return (
      <div className="w-full">
        <div className="py-12 text-center">
          <p className="text-gray-400">Please log in to view your messages.</p>
          <Link href="/forums" className="mt-2 inline-block text-blue-400 hover:text-blue-300">
            Go to Forums
          </Link>
        </div>
      </div>
    );
  }

  // Removed loading skeleton - no loading states wanted

  if (error) {
    return (
      <div className="w-full">
        <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => fetchInbox()} className="mt-2 text-red-400 hover:text-red-300">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-lg border border-gray-700 bg-gray-900/30">
        {/* Header */}
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Messages
              {inboxData?.unreadCount ? (
                <span className="ml-2 rounded-full bg-blue-600/30 px-2 py-1 text-xs text-blue-400">
                  {inboxData.unreadCount}
                </span>
              ) : null}
            </h1>

            {/* Filter tabs */}
            <div className="flex space-x-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread' },
                { key: 'sent', label: 'Sent' },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded px-3 py-1 text-sm ${
                    activeFilter === filter.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="divide-y divide-gray-700">
          {!inboxData?.conversations.length ? (
            <div className="p-8 text-center text-gray-400">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.126-.317l-4.95.867a1 1 0 01-1.213-.728l.728-4.192A8 8 0 0121 12z"
                />
              </svg>
              <p className="mb-2 text-lg font-medium">No conversations yet</p>
              <p>Start a conversation by visiting someone's profile and sending them a message.</p>
            </div>
          ) : (
            inboxData.conversations.map(conversation => (
              <Link
                key={conversation.conversation_id}
                href={getConversationUrlFromUsername(
                  conversation.other_user?.username || conversation.other_username || ''
                )}
                className="block p-4 transition-colors hover:bg-gray-800/50"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {conversation.other_user?.avatar_url ? (
                      <img
                        src={conversation.other_user.avatar_url}
                        alt={
                          conversation.other_user?.display_name ||
                          conversation.other_display_name ||
                          'User'
                        }
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 font-semibold text-gray-300">
                        {getInitials(
                          conversation.other_user?.display_name ||
                            conversation.other_user?.username ||
                            conversation.other_display_name ||
                            conversation.other_username ||
                            'U'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conversation Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={`truncate text-sm font-medium ${
                          conversation.unread_count > 0 ? 'text-white' : 'text-gray-300'
                        }`}
                      >
                        {conversation.other_user?.display_name ||
                          conversation.other_user?.username ||
                          conversation.other_display_name ||
                          conversation.other_username ||
                          'Unknown User'}
                      </p>
                      <div className="flex items-center space-x-2">
                        {conversation.last_message_time && (
                          <p className="text-xs text-gray-500">
                            {formatTimeAgo(conversation.last_message_time)}
                          </p>
                        )}
                        {conversation.unread_count > 0 && (
                          <span className="min-w-[20px] rounded-full bg-blue-600 px-2 py-1 text-center text-xs text-white">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {conversation.last_message_preview && (
                      <div className="mt-1 flex items-center">
                        {conversation.is_last_message_from_me && (
                          <span className="mr-1 text-xs text-gray-500">You:</span>
                        )}
                        <p
                          className={`truncate text-sm ${
                            conversation.unread_count > 0 && !conversation.is_last_message_from_me
                              ? 'font-medium text-white'
                              : 'text-gray-400'
                          }`}
                        >
                          {conversation.last_message_preview}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Online indicator */}
                  {conversation.other_user?.last_seen && (
                    <div className="flex-shrink-0">
                      {new Date(conversation.other_user?.last_seen).getTime() >
                        Date.now() - 5 * 60 * 1000 && (
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        {inboxData?.pagination && inboxData.pagination.totalPages > 1 && (
          <div className="border-t border-gray-700 bg-gray-900/20 p-4">
            <div className="flex justify-center">
              <p className="text-sm text-gray-400">
                Page {inboxData.pagination.page} of {inboxData.pagination.totalPages}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
