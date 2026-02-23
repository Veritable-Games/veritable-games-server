'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';
// Socket.IO removed - using HTTP-only implementation

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  last_seen?: string;
}

interface Message {
  id: number;
  from_user_id: number;
  to_user_id: number;
  subject?: string;
  content: string;
  read_status: boolean;
  created_at: string;
  is_from_me: boolean;
  sender: User;
}

interface ConversationData {
  conversation: {
    id: number | null;
    other_user: User;
    unread_count: number;
    is_archived: boolean;
    relationship: any;
  };
  messages: Message[];
  pagination: {
    page: number;
    totalPages: number;
    hasMore: boolean;
    hasNewer: boolean;
  };
}

interface ConversationViewProps {
  userId: number;
}

interface Conversation {
  id: number | null;
  other_user: User;
  unread_count: number;
  is_archived: boolean;
  subject?: string;
}

export function ConversationView({ userId }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Socket.IO typing indicators removed

  const { user, isAuthenticated } = useAuth();
  // Socket.IO client removed
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Typing timeout removed with Socket.IO

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = useCallback(async () => {
    if (!userId) {
      setError('Invalid user ID');
      return;
    }

    try {
      const response = await fetch(`/api/messages/conversation/${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view this conversation');
          return;
        }
        if (response.status === 404) {
          setError('Conversation not found');
          setLoading(false);
          return;
        }
        // Log the actual error for debugging
        logger.error(`Conversation fetch failed with status ${response.status}`);
        let errorMessage = `Failed to fetch conversation (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Could not parse error response
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setConversation(data.data.conversation);
      } else {
        setError(data.error || 'Failed to load conversation');
        setLoading(false);
        return;
      }
    } catch (error) {
      logger.error('Error fetching conversation:', error);
      setError('Failed to load conversation');
      setLoading(false);
    }
  }, [userId]);

  const fetchMessages = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/messages/conversation/${userId}/messages`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      if (data.success) {
        setMessages(data.data.messages || []);
      }
    } catch (error) {
      logger.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    if (isAuthenticated && user) {
      setLoading(true);

      fetchConversation().catch(error => {
        if (isMounted) {
          logger.error('Error in fetchConversation effect:', error);
          throw new Error('Failed to load conversation');
          setLoading(false);
        }
      });
      fetchMessages().catch(error => {
        if (isMounted) {
          logger.error('Error in fetchMessages effect:', error);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [userId, isAuthenticated, user, fetchConversation, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket.IO event handlers removed - using HTTP-only messaging
  // Future enhancement: Consider Server-Sent Events for real-time messaging

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) {
      return;
    }

    setSending(true);

    try {
      // Socket.IO removed - using HTTP API for all message sending
      const fetchOptions = {
        method: 'POST',
        credentials: 'include' as const,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_user_id: userId,
          content: newMessage.trim(),
        }),
      };

      const response = await fetch('/api/messages/send', fetchOptions);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // JSON parsing failed, use status code
        }
        throw new Error(errorData?.error || `Failed to send message (${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, data.data.message]);
        setNewMessage('');
        // Refresh conversation to update unread counts
        fetchConversation().catch(error => {
          logger.error('Error refreshing conversation after sending message:', error);
        });
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      alert(errorMessage); // In production, use a proper toast notification
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return (
        date.toLocaleDateString() +
        ' ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }
  };

  const getOtherUser = () => {
    return conversation?.other_user || null;
  };

  // Typing indicators removed with Socket.IO - future: implement with Server-Sent Events

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center">
        <h3 className="mb-2 text-lg font-medium text-white">Login Required</h3>
        <p className="mb-4 text-gray-400">Please log in to view this conversation</p>
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
        <span className="ml-3 text-gray-400">Loading conversation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <h3 className="mb-2 text-lg font-medium text-red-400">Error</h3>
        <p className="mb-4 text-gray-400">{error}</p>
        <Link
          href="/messages"
          className="rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-500"
        >
          Back to Messages
        </Link>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="py-12 text-center">
        <h3 className="mb-2 text-lg font-medium text-white">Conversation Not Found</h3>
        <p className="mb-4 text-gray-400">
          This conversation may have been deleted or you don't have access to it
        </p>
        <Link
          href="/messages"
          className="rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-500"
        >
          Back to Messages
        </Link>
      </div>
    );
  }

  const otherUser = getOtherUser();

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-700 bg-gray-900/30">
      {/* Conversation Header */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {conversation.subject ||
                `Conversation with ${otherUser?.display_name || otherUser?.username || 'User'}`}
            </h1>
            <p className="text-sm text-gray-400">
              {otherUser
                ? `with ${otherUser.display_name || otherUser.username}`
                : 'Private conversation'}
            </p>
          </div>
          <Link
            href="/messages"
            className="text-sm text-gray-400 transition-colors hover:text-blue-400"
          >
            ← Back to Messages
          </Link>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No messages in this conversation yet.
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.from_user_id === user?.id;
            const showAvatar =
              index === 0 || messages[index - 1]?.from_user_id !== message.from_user_id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 ${isOwnMessage ? 'ml-2' : 'mr-2'}`}>
                    {showAvatar ? (
                      message.sender?.avatar_url ? (
                        <img
                          src={message.sender.avatar_url}
                          alt={`${message.sender.display_name || message.sender.username}'s avatar`}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700">
                          <span className="text-sm font-medium text-gray-300">
                            {isOwnMessage
                              ? user?.username?.charAt(0).toUpperCase() || 'Y'
                              : otherUser?.username?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="h-8 w-8"></div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={`mt-1 text-xs ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}
                    >
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator removed with Socket.IO */}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-gray-700 p-4">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              disabled={sending}
              placeholder="Type your message..."
              className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex items-center rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </form>
          <div className="mt-1 text-xs text-gray-500">{newMessage.length}/1000 characters</div>
        </div>
      </div>
    </div>
  );
}

export default ConversationView;
