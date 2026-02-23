'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/users/types';
import { SettingsSection } from '@/components/settings/ui';
import { logger } from '@/lib/utils/logger';

interface LoginHistoryEntry {
  id: number;
  successful: boolean;
  failureReason: string | null;
  browser: string;
  device: string;
  os: string;
  timestamp: string;
}

interface LoginHistorySectionProps {
  user: User;
}

export function LoginHistorySection({ user }: LoginHistorySectionProps) {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/settings/login-history?limit=20', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch login history');
        }

        const data = await response.json();
        setHistory(data.data.history || []);
      } catch (err) {
        logger.error('Failed to fetch login history:', err);
        setError('Failed to load login history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // More than 7 days - show full date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (device: string) => {
    const deviceLower = device.toLowerCase();
    if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
      return (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 16.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z" />
          <path
            fillRule="evenodd"
            d="M4 4a3 3 0 013-3h6a3 3 0 013 3v12a3 3 0 01-3 3H7a3 3 0 01-3-3V4zm4-1.5v.75c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75V2.5h1A1.5 1.5 0 0114.5 4v12a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 16V4A1.5 1.5 0 017 2.5h1z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else if (deviceLower.includes('tablet')) {
      return (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5 1a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V3a2 2 0 00-2-2H5zm0 3a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V4z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    // Desktop
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  if (isLoading) {
    return (
      <SettingsSection
        title="Login History"
        description="View your recent login attempts and device information"
      >
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-700"></div>
                  <div className="h-3 w-48 rounded bg-gray-700"></div>
                  <div className="h-3 w-24 rounded bg-gray-700"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    );
  }

  if (error) {
    return (
      <SettingsSection
        title="Login History"
        description="View your recent login attempts and device information"
      >
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </SettingsSection>
    );
  }

  if (history.length === 0) {
    return (
      <SettingsSection
        title="Login History"
        description="View your recent login attempts and device information"
      >
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-sm text-gray-400">
          No login history available
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Login History"
      description="Recent login attempts from the last 20 sessions"
    >
      <div className="space-y-3">
        {history.map(entry => (
          <div
            key={entry.id}
            className={`rounded-lg border p-4 transition-colors ${
              entry.successful
                ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800/70'
                : 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Device Icon */}
              <div
                className={`flex-shrink-0 ${entry.successful ? 'text-gray-400' : 'text-red-400'}`}
              >
                {getDeviceIcon(entry.device)}
              </div>

              {/* Login Details */}
              <div className="flex-1 space-y-1">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {entry.successful ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-400">
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Successful login
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Failed login
                      {entry.failureReason && ` - ${entry.failureReason}`}
                    </span>
                  )}
                </div>

                {/* Device Info */}
                <div className="text-sm text-gray-400">
                  <span className="font-medium">{entry.browser}</span>
                  {' on '}
                  <span className="font-medium">{entry.os}</span>
                  {entry.device !== 'Desktop' && entry.device !== 'Unknown' && (
                    <>
                      {' · '}
                      <span className="font-medium">{entry.device}</span>
                    </>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-xs text-gray-500">{formatDate(entry.timestamp)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Login history is kept for 90 days. Showing the 20 most recent attempts.
      </p>
    </SettingsSection>
  );
}
