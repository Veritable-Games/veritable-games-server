'use client';

import React, { useState, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
interface User {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

interface MessageComposeFormProps {
  recipientId: number;
  recipient: User;
}

export function MessageComposeForm({ recipientId, recipient }: MessageComposeFormProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      setError('Please log in to send messages');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!message.trim()) {
      setError('Message content is required');
      return;
    }

    setSending(true);

    try {
      const response = await fetchWithCSRF('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: recipientId,
          subject: subject.trim(),
          content: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send message');
        setSending(false);
        return;
      }

      if (data.success) {
        setSuccess(true);
        setSubject('');
        setMessage('');

        // Use startTransition for non-blocking navigation after success
        startTransition(() => {
          setTimeout(() => {
            router.push(`/messages/conversation/${recipientId}`);
          }, 1500);
        });
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-medium text-white">Login Required</h3>
          <p className="mb-4 text-gray-400">You must be logged in to send messages.</p>
          <button
            onClick={() => router.push('/forums')}
            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
          >
            Go to Forums
          </button>
        </div>
      </div>
    );
  }

  if (user?.id === recipientId) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-medium text-red-400">Cannot Send Message</h3>
          <p className="mb-4 text-gray-400">You cannot send a message to yourself.</p>
          <button
            onClick={() => router.push('/forums/users')}
            className="rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-500"
          >
            Browse Users
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">Message Sent!</h3>
          <p className="mb-4 text-gray-400">
            Your message has been sent to {recipient.display_name || recipient.username}.
          </p>
          <p className="text-sm text-gray-500">Redirecting to conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-700 bg-red-900/30 px-4 py-3 text-red-400">
            {error}
          </div>
        )}

        {/* Subject Field */}
        <div>
          <label
            htmlFor={`${formId}-subject`}
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Subject
          </label>
          <input
            type="text"
            id={`${formId}-subject`}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={sending || isPending}
            placeholder="Enter message subject..."
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            maxLength={200}
          />
        </div>

        {/* Message Content */}
        <div>
          <label
            htmlFor={`${formId}-message`}
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Message
          </label>
          <textarea
            id={`${formId}-message`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={sending || isPending}
            placeholder={`Write your message to ${recipient.display_name || recipient.username}...`}
            rows={8}
            className="resize-vertical w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            maxLength={5000}
          />
          <div className="mt-1 text-right text-xs text-gray-500">
            {message.length}/5000 characters
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => startTransition(() => router.back())}
            disabled={sending || isPending}
            className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || isPending || !subject.trim() || !message.trim()}
            className="flex items-center space-x-2 rounded bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(sending || isPending) && (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            )}
            <span>{sending ? 'Sending...' : isPending ? 'Processing...' : 'Send Message'}</span>
          </button>
        </div>
      </form>

      {/* Tips */}
      <div className="mt-6 border-t border-gray-700 pt-4">
        <h4 className="mb-2 text-sm font-medium text-gray-300">Tips:</h4>
        <ul className="space-y-1 text-xs text-gray-500">
          <li>• Be respectful and follow community guidelines</li>
          <li>• Messages are private between participants</li>
          <li>• You can continue the conversation after sending</li>
        </ul>
      </div>
    </div>
  );
}

export default MessageComposeForm;
