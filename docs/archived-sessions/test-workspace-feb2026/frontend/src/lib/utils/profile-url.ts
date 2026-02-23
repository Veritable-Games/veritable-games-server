/**
 * Profile URL Utilities
 *
 * Centralized utilities for generating profile-related URLs.
 * Profile URLs use usernames as slugs instead of numeric IDs.
 *
 * This provides:
 * - Human-readable URLs (/profile/admin instead of /profile/1)
 * - URLs that update when username changes
 * - Backward compatibility with numeric IDs
 */

/**
 * Generate a profile page URL from a user object
 */
export function getProfileUrl(user: { username: string }): string {
  return `/profile/${encodeURIComponent(user.username)}`;
}

/**
 * Generate a profile page URL from just a username string
 */
export function getProfileUrlFromUsername(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}

/**
 * Generate a message conversation URL from a user object
 */
export function getConversationUrl(user: { username: string }): string {
  return `/messages/conversation/${encodeURIComponent(user.username)}`;
}

/**
 * Generate a message conversation URL from just a username string
 */
export function getConversationUrlFromUsername(username: string): string {
  return `/messages/conversation/${encodeURIComponent(username)}`;
}

/**
 * Check if a profile identifier is a numeric ID (legacy format)
 * Used for backward compatibility with old /profile/123 URLs
 */
export function isNumericProfileId(identifier: string): boolean {
  return /^\d+$/.test(identifier);
}

/**
 * Parse a profile identifier - could be numeric ID or username
 * Returns { isNumeric, value } for routing decisions
 */
export function parseProfileIdentifier(identifier: string): {
  isNumeric: boolean;
  numericId: number | null;
  username: string | null;
} {
  const isNumeric = isNumericProfileId(identifier);
  return {
    isNumeric,
    numericId: isNumeric ? parseInt(identifier, 10) : null,
    username: isNumeric ? null : identifier,
  };
}
