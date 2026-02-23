/**
 * ClientDate Component
 *
 * Renders dates in a hydration-safe way by only rendering on the client.
 * Prevents React hydration mismatch errors (#418) caused by timezone/locale differences
 * between server (UTC) and client (user's local timezone).
 *
 * Usage:
 * ```tsx
 * <ClientDate date={topic.created_at} format="full" />
 * <ClientDate date={reply.updated_at} format="date" />
 * <ClientDate date={category.last_activity_at} format="time" />
 * ```
 *
 * @module components/ui/ClientDate
 */

'use client';

import { useState, useEffect } from 'react';

export interface ClientDateProps {
  date: string | Date | null | undefined;
  format?: 'full' | 'date' | 'time' | 'relative';
  placeholder?: string;
  className?: string;
}

/**
 * Format date on client only (prevents hydration mismatch)
 */
export function ClientDate({
  date,
  format = 'full',
  placeholder = '—',
  className,
}: ClientDateProps) {
  const [mounted, setMounted] = useState(false);

  // Only render after client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, show placeholder
  if (!mounted || !date) {
    return <span className={className}>{placeholder}</span>;
  }

  // Client-side rendering with locale-specific formatting
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return <span className={className}>{placeholder}</span>;
  }

  let formatted: string;

  switch (format) {
    case 'full':
      formatted = dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      break;

    case 'date':
      formatted = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      break;

    case 'time':
      formatted = dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      break;

    case 'relative':
      formatted = getRelativeTime(dateObj);
      break;

    default:
      formatted = dateObj.toLocaleString();
  }

  return <span className={className}>{formatted}</span>;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
