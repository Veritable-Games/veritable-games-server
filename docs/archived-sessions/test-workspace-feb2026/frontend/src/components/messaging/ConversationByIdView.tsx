'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';
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

interface Conversation {
  id: number;
  other_user: User;
  unread_count: number;
  is_archived: boolean;
  latest_message?: {
    content: string;
    created_at: string;
    is_from_me: boolean;
  };
}

interface ConversationByIdViewProps {
  conversationId: number;
}

export function ConversationByIdView({ conversationId }: ConversationByIdViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { user, isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch conversation details by ID
  const fetchConversation = useCallback(async () => {
    if (!conversationId) {
      throw new Error('Invalid conversation ID');
      return;
    }

    try {
      setLoading(true);

      // Fetch conversation details
      const convResponse = await fetch(`/api/messages/conversations/${conversationId}`, {
        credentials: 'include',
      });

      if (!convResponse.ok) {
        if (convResponse.status === 401) {
          throw new Error('Please log in to view this conversation');
          return;
        }
        if (convResponse.status === 404) {
          throw new Error('Conversation not found or you do not have access to it');
          return;
        }
        throw new Error(`Failed to fetch conversation: ${convResponse.status}`);
      }

      const convData = await convResponse.json();
      setConversation(convData.conversation);

      // Fetch messages for this conversation
      const msgResponse = await fetch(
        `/api/messages/conversations/${conversationId}/messages?page=${page}`,
        { credentials: 'include' }
      );

      if (!msgResponse.ok) {
        throw new Error(`Failed to fetch messages: ${msgResponse.status}`);
      }

      const msgData = await msgResponse.json();
      setMessages(msgData.messages || []);
      setHasMore(msgData.pagination?.hasMore || false);
    } catch (err) {
      logger.error('Error fetching conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId, page]);

  // Send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !conversation) {
      return;
    }

    try {
      setSending(true);

      const options = {
        method: 'POST',
        credentials: 'include' as const,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage.trim(),
        }),
      };

      const response = await fetch(
        `/api/messages/conversations/${conversationId}/messages`,
        options
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Add the new message to the list
      setMessages(prev => [...prev, data.message]);
      setNewMessage('');

      // Scroll to the new message
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      logger.error('Error sending message:', err);
      throw new Error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Load more messages
  const loadMoreMessages = async () => {
    if (!hasMore || loading) return;

    try {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/messages?page=${page + 1}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to load more messages');
      }

      const data = await response.json();
      setMessages(prev => [...(data.messages || []), ...prev]);
      setPage(prev => prev + 1);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      logger.error('Error loading more messages:', err);
    }
  };

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      fetchConversation();
    }
  }, [isAuthenticated, fetchConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && page === 1) {
      scrollToBottom();
    }
  }, [messages, page]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-gray-400">Please log in to view messages</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
          <span className="ml-3 text-gray-400">Loading conversation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <button
            onClick={fetchConversation}
            className="rounded-lg bg-blue-600 px-4 py-2 transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-gray-400">Conversation not found</p>
          <Link href="/messages" className="text-blue-400 hover:text-blue-300">
            Back to Messages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {conversation.other_user.avatar_url ? (
              <img
                src={conversation.other_user.avatar_url}
                alt={conversation.other_user.display_name}
                className="mr-3 h-10 w-10 rounded-full"
              />
            ) : (
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
                <span className="text-sm font-medium text-gray-300">
                  {conversation.other_user.display_name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div>
              <h2 className="font-semibold text-white">{conversation.other_user.display_name}</h2>
              <p className="text-sm text-gray-400">@{conversation.other_user.username}</p>
            </div>
          </div>
          <Link href="/messages" className="text-gray-400 transition-colors hover:text-white">
            Back to Messages
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-4 overflow-y-auto px-6 py-4 [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
      >
        {hasMore && (
          <div className="text-center">
            <button
              onClick={loadMoreMessages}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Load older messages
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.is_from_me ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.is_from_me ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className="mt-1 text-xs opacity-70">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-gray-800 px-6 py-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
