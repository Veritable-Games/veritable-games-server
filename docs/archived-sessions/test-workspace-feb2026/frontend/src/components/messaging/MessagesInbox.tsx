'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender?: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: number;
  subject: string;
  created_at: string;
  updated_at: string;
  latest_message?: Message;
  unread_count: number;
  participants?: Array<{
    user?: {
      id: number;
      username: string;
      display_name?: string;
      avatar_url?: string;
    };
  }>;
}

export function MessagesInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuth();

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/messages/conversations', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view your messages');
          setLoading(false);
          return;
        }
        setError('Failed to fetch conversations');
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        setConversations([]);
      }
    } catch (error) {
      logger.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    let mounted = true;

    const loadConversations = async () => {
      if (isAuthenticated && user) {
        try {
          await fetchConversations();
        } catch (error) {
          if (mounted) {
            logger.error('Error loading conversations:', error);
          }
        }
      } else {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadConversations();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user, fetchConversations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getOtherParticipants = useCallback(
    (conversation: Conversation) => {
      if (!conversation?.participants || !user) return [];
      return conversation.participants
        .filter(p => p?.user?.id !== user.id)
        .map(p => p.user)
        .filter(Boolean) as NonNullable<(typeof conversation.participants)[number]['user']>[];
    },
    [user]
  );

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-gray-400">
          <svg
            className="mx-auto mb-4 h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.455L3 21l2.455-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-white">Login Required</h3>
        <p className="mb-4 text-gray-400">Please log in to view your messages</p>
        <Link
          href="/forums"
          className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
        >
          Go to Forums
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
        <span className="ml-3 text-gray-400">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-red-400">
          <svg
            className="mx-auto mb-4 h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-white">Error Loading Messages</h3>
        <p className="mb-4 text-gray-400">{error}</p>
        <button
          onClick={() => fetchConversations()}
          className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-gray-400">
          <svg
            className="mx-auto mb-4 h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.455L3 21l2.455-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-white">No Messages Yet</h3>
        <p className="mb-4 text-gray-400">
          Start a conversation by sending a message to another user
        </p>
        <Link
          href="/users"
          className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
        >
          Browse Users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversations.map(conversation => {
        const otherParticipants = getOtherParticipants(conversation);
        const displayUser = otherParticipants[0];

        return (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            className="block rounded-lg border border-gray-700 bg-gray-900/30 p-4 transition-colors hover:bg-gray-900/50"
          >
            <div className="flex items-start space-x-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {displayUser?.avatar_url ? (
                  <img
                    src={displayUser.avatar_url}
                    alt={`${displayUser.display_name || displayUser.username}'s avatar`}
                    className="h-12 w-12 rounded-full bg-gray-800"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800">
                    <span className="text-lg font-medium text-gray-300">
                      {displayUser
                        ? (displayUser.display_name || displayUser.username).charAt(0).toUpperCase()
                        : '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Conversation Info */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="truncate font-medium text-white">{conversation.subject}</h3>
                    {conversation.unread_count > 0 && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(conversation.latest_message?.created_at || conversation.updated_at)}
                  </span>
                </div>

                <p className="mb-1 text-sm text-gray-400">
                  {otherParticipants.length > 0 ? (
                    <>
                      {otherParticipants.map(p => p?.display_name || p?.username).join(', ')}
                      {otherParticipants.length > 1 && ` (+${otherParticipants.length - 1})`}
                    </>
                  ) : (
                    'Unknown participant'
                  )}
                </p>

                {conversation.latest_message && (
                  <p className="truncate text-sm text-gray-300">
                    <span className="text-gray-500">
                      {conversation.latest_message.sender?.display_name ||
                        conversation.latest_message.sender?.username}
                      :
                    </span>{' '}
                    {truncateContent(conversation.latest_message.content)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default MessagesInbox;
