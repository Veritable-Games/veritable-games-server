/**
 * RelativeTime Component
 *
 * Renders relative time strings (e.g., "2 hours ago") in a hydration-safe way.
 * Prevents React hydration mismatch errors by only rendering on the client.
 *
 * More sophisticated than ClientDate's relative format - includes weeks, months,
 * and smarter formatting for different time ranges.
 *
 * Usage:
 * ```tsx
 * <RelativeTime date={topic.created_at} />
 * <RelativeTime date={reply.created_at} showTooltip />
 * ```
 *
 * @module components/ui/RelativeTime
 */

'use client';

import { useState, useEffect } from 'react';

export interface RelativeTimeProps {
  date: string | Date | null | undefined;
  placeholder?: string;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Format date as relative time on client only (prevents hydration mismatch)
 */
export function RelativeTime({
  date,
  placeholder = '—',
  className,
  showTooltip = false,
}: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);

  // Only render after client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, show placeholder
  if (!mounted || !date) {
    return <span className={className}>{placeholder}</span>;
  }

  // Client-side rendering with sophisticated relative time formatting
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return <span className={className}>{placeholder}</span>;
  }

  const formatted = formatRelativeTime(dateObj);
  const fullDate = showTooltip ? formatFullDate(dateObj) : undefined;

  if (showTooltip) {
    return (
      <time dateTime={dateObj.toISOString()} title={fullDate} className={className}>
        {formatted}
      </time>
    );
  }

  return (
    <time dateTime={dateObj.toISOString()} className={className}>
      {formatted}
    </time>
  );
}

/**
 * Format date as sophisticated relative time string
 * Based on TopicRow's formatDate logic
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  // Handle future dates
  if (diffMs < 0) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Less than 1 minute
  if (diffSeconds < 60) {
    return 'just now';
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    if (diffMinutes === 1) return '1 min ago';
    return `${diffMinutes} mins ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  }

  // Yesterday
  if (diffDays === 1) {
    return 'yesterday';
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Less than 4 weeks
  if (diffWeeks < 4) {
    if (diffWeeks === 1) return '1 week ago';
    return `${diffWeeks} weeks ago`;
  }

  // Less than 3 months - show month and day
  if (diffMonths < 3) {
    // Same year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  }

  // 3+ months or different year - always show year
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date as full date/time string for tooltips
 */
function formatFullDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
