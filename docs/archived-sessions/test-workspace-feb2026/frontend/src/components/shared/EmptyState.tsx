/**
 * Shared EmptyState Component
 *
 * Reusable empty state for displaying when there's no data.
 * Used for empty subscriptions, empty donations, empty campaigns, etc.
 *
 * Design:
 * - Dark theme with site colors (#0a0a0a, #ededed, #60a5fa)
 * - Kalinga font (inherited)
 * - Optional icon
 * - Optional CTA button
 * - Center-aligned, friendly messaging
 */

import React from 'react';
import Link from 'next/link';

export interface EmptyStateProps {
  /** Main title/heading */
  title: string;
  /** Description text */
  description?: string;
  /** Optional icon identifier */
  icon?: 'inbox' | 'gift' | 'calendar' | 'document' | 'users';
  /** Optional CTA button text */
  ctaText?: string;
  /** Optional CTA button href */
  ctaHref?: string;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * EmptyState Component
 *
 * @example
 * ```tsx
 * <EmptyState
 *   title="No active subscriptions"
 *   description="You don't have any recurring donations set up yet."
 *   icon="gift"
 *   ctaText="Set up a recurring donation"
 *   ctaHref="/donate?frequency=monthly"
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  icon,
  ctaText,
  ctaHref,
  className = '',
}: EmptyStateProps) {
  const icons = {
    inbox: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    ),
    gift: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
      />
    ),
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    ),
  };

  return (
    <div
      className={`rounded-lg border border-gray-700/40 bg-gray-800/50 p-8 text-center ${className}`}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-gray-700/30 p-3">
            <svg
              className="h-8 w-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {icons[icon]}
            </svg>
          </div>
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 text-lg font-medium text-gray-300">{title}</h3>

      {/* Description */}
      {description && <p className="mb-6 text-sm text-gray-400">{description}</p>}

      {/* CTA Button */}
      {ctaText && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}
