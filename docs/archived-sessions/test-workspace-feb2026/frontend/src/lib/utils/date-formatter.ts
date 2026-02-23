/**
 * Centralized date formatting utilities for Veritable Games
 *
 * Handles multiple date formats from the anarchist library archive:
 * - Year-only strings: "2021", "2016"
 * - Full ISO dates: "2017-06-29", "2016-01-11"
 * - Null/undefined values
 *
 * CRITICAL: Never concatenates with view_count or other numeric values
 */

/**
 * Format publication date for display
 *
 * @param dateString - Publication date from database (TEXT column)
 * @param format - Display format ('full' or 'year')
 * @returns Formatted date string
 *
 * Examples:
 * - "2021" → "2021" (year format) or "2021" (full format, year-only)
 * - "2016-01-11" → "2016" (year format) or "January 11, 2016" (full format)
 * - null → "—"
 */
import { logger } from '@/lib/utils/logger';

export function formatPublicationDate(
  dateString: string | null | undefined,
  format: 'full' | 'year' = 'year'
): string {
  // Handle null/undefined
  if (!dateString) {
    return '—';
  }

  // Trim whitespace
  const trimmed = dateString.trim();
  if (!trimmed) {
    return '—';
  }

  try {
    // Check if it's a year-only string (4 digits)
    const yearOnlyMatch = /^\d{4}$/.test(trimmed);

    if (yearOnlyMatch) {
      // Year-only date: just return the year
      return trimmed;
    }

    // Full date string: parse and format
    const date = new Date(trimmed);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      // Invalid date, return original string
      return trimmed;
    }

    if (format === 'year') {
      // Return just the year
      return date.getFullYear().toString();
    } else {
      // Return full formatted date
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch (error) {
    // If any error occurs, return original string or fallback
    logger.warn('[formatPublicationDate] Error formatting date:', {
      dateString,
      error: error instanceof Error ? error.message : String(error),
    });
    return trimmed || '—';
  }
}

/**
 * Format created_at timestamp for display
 *
 * @param timestamp - ISO timestamp from database
 * @returns Formatted date string
 */
export function formatCreatedAt(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return '—';
  }

  try {
    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    logger.warn('[formatCreatedAt] Error formatting timestamp:', {
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    });
    return '—';
  }
}

/**
 * Format date for "Published" display (fallback to created_at if no publication_date)
 *
 * @param publicationDate - Publication date (year or full date)
 * @param createdAt - Created timestamp (ISO format)
 * @param format - Display format
 * @returns Formatted date string
 */
export function formatPublishedDate(
  publicationDate: string | null | undefined,
  createdAt: string | null | undefined,
  format: 'full' | 'year' = 'full'
): string {
  // Prefer publication_date if available
  if (publicationDate) {
    return formatPublicationDate(publicationDate, format);
  }

  // Fallback to created_at
  if (createdAt) {
    return formatCreatedAt(createdAt);
  }

  return 'N/A';
}
