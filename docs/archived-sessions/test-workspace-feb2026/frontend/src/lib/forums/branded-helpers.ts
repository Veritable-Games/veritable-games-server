/**
 * Forum Branded Type Runtime Validators
 *
 * Provides runtime validation and safe conversion utilities for branded types.
 * These helpers enforce type safety at runtime with proper error handling.
 *
 * ## Naming Convention:
 * - `toXXXId(value)` - Strict validator (throws TypeError on invalid input)
 * - `toXXXIdSafe(value)` - Safe validator (returns null on invalid input)
 * - `toXXXIdArray(values)` - Array validator (filters out invalid values)
 *
 * ## Usage Examples:
 *
 * ```typescript
 * // Strict validation (throws on error)
 * const topicId = toTopicId(123); // ✅ Returns TopicId
 * const topicId = toTopicId("invalid"); // ❌ Throws TypeError
 *
 * // Safe validation (returns null on error)
 * const topicId = toTopicIdSafe(123); // ✅ Returns TopicId
 * const topicId = toTopicIdSafe("invalid"); // ✅ Returns null
 *
 * // Array validation (filters out invalid values)
 * const ids = toTopicIdArray([1, 2, "invalid", 3]); // ✅ Returns [1, 2, 3] as TopicId[]
 * ```
 *
 * ## Integration with Zod:
 *
 * ```typescript
 * const TopicIdSchema = z.number().int().positive().transform(toTopicId);
 * const SafeTopicIdSchema = z.unknown().transform(toTopicIdSafe);
 * ```
 *
 * @module lib/forums/branded-helpers
 */

import type { ForumId, TopicId, ReplyId, CategoryId, TagId, UserId } from './types';

// ============================================================================
// Validation Error Messages
// ============================================================================

const ERROR_MESSAGES = {
  FORUM_ID: 'Invalid ForumId: must be a positive integer',
  TOPIC_ID: 'Invalid TopicId: must be a positive integer',
  REPLY_ID: 'Invalid ReplyId: must be a positive integer',
  CATEGORY_ID: 'Invalid CategoryId: must be a positive integer',
  TAG_ID: 'Invalid TagId: must be a positive integer',
  USER_ID: 'Invalid UserId: must be a positive integer',
} as const;

// ============================================================================
// Base Validation Logic
// ============================================================================

/**
 * Internal validation function for all ID types
 *
 * @param value - Value to validate
 * @param errorMessage - Error message to throw on failure
 * @returns Validated number (cast to branded type by caller)
 * @throws {TypeError} If value is not a positive integer
 */
function validateId(value: unknown, errorMessage: string): number {
  // Check if value is a number
  if (typeof value !== 'number') {
    throw new TypeError(`${errorMessage} (received: ${typeof value})`);
  }

  // Check if value is an integer
  if (!Number.isInteger(value)) {
    throw new TypeError(`${errorMessage} (received: ${value})`);
  }

  // Check if value is positive
  if (value <= 0) {
    throw new TypeError(`${errorMessage} (received: ${value})`);
  }

  // Check for NaN and Infinity
  if (!Number.isFinite(value)) {
    throw new TypeError(`${errorMessage} (received: ${value})`);
  }

  return value;
}

/**
 * Internal safe validation function (returns null instead of throwing)
 *
 * @param value - Value to validate
 * @returns Validated number or null
 */
function validateIdSafe(value: unknown): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

// ============================================================================
// ForumId Validators
// ============================================================================

/**
 * Convert value to ForumId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated ForumId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toForumId(123); // ✅ Returns ForumId
 * const id = toForumId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toForumId(value: unknown): ForumId {
  return validateId(value, ERROR_MESSAGES.FORUM_ID) as ForumId;
}

/**
 * Convert value to ForumId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated ForumId or null
 *
 * @example
 * ```typescript
 * const id = toForumIdSafe(123);      // ✅ Returns ForumId
 * const id = toForumIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toForumIdSafe(value: unknown): ForumId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as ForumId) : null;
}

/**
 * Convert array of values to ForumId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated ForumIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toForumIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toForumIdArray(values: unknown[]): ForumId[] {
  return values.map(v => toForumIdSafe(v)).filter((id): id is ForumId => id !== null);
}

// ============================================================================
// TopicId Validators
// ============================================================================

/**
 * Convert value to TopicId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated TopicId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toTopicId(123); // ✅ Returns TopicId
 * const id = toTopicId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toTopicId(value: unknown): TopicId {
  return validateId(value, ERROR_MESSAGES.TOPIC_ID) as TopicId;
}

/**
 * Convert value to TopicId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated TopicId or null
 *
 * @example
 * ```typescript
 * const id = toTopicIdSafe(123);      // ✅ Returns TopicId
 * const id = toTopicIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toTopicIdSafe(value: unknown): TopicId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as TopicId) : null;
}

/**
 * Convert array of values to TopicId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated TopicIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toTopicIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toTopicIdArray(values: unknown[]): TopicId[] {
  return values.map(v => toTopicIdSafe(v)).filter((id): id is TopicId => id !== null);
}

// ============================================================================
// ReplyId Validators
// ============================================================================

/**
 * Convert value to ReplyId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated ReplyId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toReplyId(123); // ✅ Returns ReplyId
 * const id = toReplyId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toReplyId(value: unknown): ReplyId {
  return validateId(value, ERROR_MESSAGES.REPLY_ID) as ReplyId;
}

/**
 * Convert value to ReplyId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated ReplyId or null
 *
 * @example
 * ```typescript
 * const id = toReplyIdSafe(123);      // ✅ Returns ReplyId
 * const id = toReplyIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toReplyIdSafe(value: unknown): ReplyId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as ReplyId) : null;
}

/**
 * Convert array of values to ReplyId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated ReplyIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toReplyIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toReplyIdArray(values: unknown[]): ReplyId[] {
  return values.map(v => toReplyIdSafe(v)).filter((id): id is ReplyId => id !== null);
}

// ============================================================================
// CategoryId Validators
// ============================================================================

/**
 * Convert value to CategoryId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated CategoryId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toCategoryId(123); // ✅ Returns CategoryId
 * const id = toCategoryId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toCategoryId(value: unknown): CategoryId {
  return validateId(value, ERROR_MESSAGES.CATEGORY_ID) as CategoryId;
}

/**
 * Convert value to CategoryId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated CategoryId or null
 *
 * @example
 * ```typescript
 * const id = toCategoryIdSafe(123);      // ✅ Returns CategoryId
 * const id = toCategoryIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toCategoryIdSafe(value: unknown): CategoryId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as CategoryId) : null;
}

/**
 * Convert array of values to CategoryId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated CategoryIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toCategoryIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toCategoryIdArray(values: unknown[]): CategoryId[] {
  return values.map(v => toCategoryIdSafe(v)).filter((id): id is CategoryId => id !== null);
}

// ============================================================================
// TagId Validators
// ============================================================================

/**
 * Convert value to TagId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated TagId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toTagId(123); // ✅ Returns TagId
 * const id = toTagId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toTagId(value: unknown): TagId {
  return validateId(value, ERROR_MESSAGES.TAG_ID) as TagId;
}

/**
 * Convert value to TagId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated TagId or null
 *
 * @example
 * ```typescript
 * const id = toTagIdSafe(123);      // ✅ Returns TagId
 * const id = toTagIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toTagIdSafe(value: unknown): TagId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as TagId) : null;
}

/**
 * Convert array of values to TagId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated TagIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toTagIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toTagIdArray(values: unknown[]): TagId[] {
  return values.map(v => toTagIdSafe(v)).filter((id): id is TagId => id !== null);
}

// ============================================================================
// UserId Validators
// ============================================================================

/**
 * Convert value to UserId with strict validation
 *
 * @param value - Value to convert
 * @returns Validated UserId
 * @throws {TypeError} If value is not a positive integer
 *
 * @example
 * ```typescript
 * const id = toUserId(123); // ✅ Returns UserId
 * const id = toUserId(-1);  // ❌ Throws TypeError
 * ```
 */
export function toUserId(value: unknown): UserId {
  return validateId(value, ERROR_MESSAGES.USER_ID) as UserId;
}

/**
 * Convert value to UserId safely (returns null on failure)
 *
 * @param value - Value to convert
 * @returns Validated UserId or null
 *
 * @example
 * ```typescript
 * const id = toUserIdSafe(123);      // ✅ Returns UserId
 * const id = toUserIdSafe("invalid"); // ✅ Returns null
 * ```
 */
export function toUserIdSafe(value: unknown): UserId | null {
  const validated = validateIdSafe(value);
  return validated !== null ? (validated as UserId) : null;
}

/**
 * Convert array of values to UserId array (filters out invalid values)
 *
 * @param values - Array of values to convert
 * @returns Array of validated UserIds (invalid values filtered out)
 *
 * @example
 * ```typescript
 * const ids = toUserIdArray([1, 2, "invalid", 3]); // ✅ [1, 2, 3]
 * ```
 */
export function toUserIdArray(values: unknown[]): UserId[] {
  return values.map(v => toUserIdSafe(v)).filter((id): id is UserId => id !== null);
}
