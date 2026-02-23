/**
 * Branded Types for Forums Module
 *
 * Provides compile-time type safety for ID types to prevent mixing different
 * entity IDs (e.g., passing a TopicId where a ReplyId is expected).
 *
 * Usage:
 * ```typescript
 * import { TopicId, toTopicId, unsafeToTopicId } from './branded-types';
 *
 * // Safe conversion with validation
 * const topicId: TopicId = toTopicId(123);
 *
 * // Unsafe conversion (database layer only)
 * const topicId: TopicId = unsafeToTopicId(row.id);
 * ```
 */

// ============================================================================
// Brand Symbols - Unique symbols for each branded type
// ============================================================================

declare const TopicIdBrand: unique symbol;
declare const ReplyIdBrand: unique symbol;
declare const CategoryIdBrand: unique symbol;
declare const TagIdBrand: unique symbol;
declare const UserIdBrand: unique symbol;
declare const ConversationIdBrand: unique symbol;
declare const ActivityIdBrand: unique symbol;

// ============================================================================
// Branded Type Definitions
// ============================================================================

/**
 * Type-safe ID for forum topics
 * Prevents mixing up topic IDs with other entity IDs
 */
export type TopicId = number & {
  readonly [TopicIdBrand]: typeof TopicIdBrand;
};

/**
 * Type-safe ID for forum replies
 * Prevents mixing up reply IDs with other entity IDs
 */
export type ReplyId = number & {
  readonly [ReplyIdBrand]: typeof ReplyIdBrand;
};

/**
 * Type-safe ID for forum categories
 * Prevents mixing up category IDs with other entity IDs
 */
export type CategoryId = number & {
  readonly [CategoryIdBrand]: typeof CategoryIdBrand;
};

/**
 * Type-safe ID for forum tags
 * Prevents mixing up tag IDs with other entity IDs
 */
export type TagId = number & { readonly [TagIdBrand]: typeof TagIdBrand };

/**
 * Type-safe ID for users
 * Prevents mixing up user IDs with other entity IDs
 */
export type UserId = number & { readonly [UserIdBrand]: typeof UserIdBrand };

/**
 * Type-safe ID for forum conversations
 * Prevents mixing up conversation IDs with other entity IDs
 */
export type ConversationId = number & {
  readonly [ConversationIdBrand]: typeof ConversationIdBrand;
};

/**
 * Type-safe ID for forum activity records
 * Prevents mixing up activity IDs with other entity IDs
 */
export type ActivityId = number & {
  readonly [ActivityIdBrand]: typeof ActivityIdBrand;
};

// ============================================================================
// Type Guards - Runtime validation with type narrowing
// ============================================================================

export function isTopicId(value: unknown): value is TopicId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isReplyId(value: unknown): value is ReplyId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isCategoryId(value: unknown): value is CategoryId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isTagId(value: unknown): value is TagId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isUserId(value: unknown): value is UserId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isConversationId(value: unknown): value is ConversationId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

export function isActivityId(value: unknown): value is ActivityId {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && Number.isSafeInteger(value)
  );
}

// ============================================================================
// Conversion Utilities - Safe conversion with validation
// ============================================================================

export function toTopicId(value: unknown): TopicId {
  if (isTopicId(value)) return value;
  throw new TypeError(
    `Invalid TopicId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toReplyId(value: unknown): ReplyId {
  if (isReplyId(value)) return value;
  throw new TypeError(
    `Invalid ReplyId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toCategoryId(value: unknown): CategoryId {
  if (isCategoryId(value)) return value;
  throw new TypeError(
    `Invalid CategoryId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toTagId(value: unknown): TagId {
  if (isTagId(value)) return value;
  throw new TypeError(
    `Invalid TagId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toUserId(value: unknown): UserId {
  if (isUserId(value)) return value;
  throw new TypeError(
    `Invalid UserId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toConversationId(value: unknown): ConversationId {
  if (isConversationId(value)) return value;
  throw new TypeError(
    `Invalid ConversationId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

export function toActivityId(value: unknown): ActivityId {
  if (isActivityId(value)) return value;
  throw new TypeError(
    `Invalid ActivityId: expected positive integer, got ${typeof value} (${String(value)})`
  );
}

// Safe conversions (return null on failure)
export function toTopicIdSafe(value: unknown): TopicId | null {
  try {
    return toTopicId(value);
  } catch {
    return null;
  }
}

export function toReplyIdSafe(value: unknown): ReplyId | null {
  try {
    return toReplyId(value);
  } catch {
    return null;
  }
}

export function toCategoryIdSafe(value: unknown): CategoryId | null {
  try {
    return toCategoryId(value);
  } catch {
    return null;
  }
}

export function toTagIdSafe(value: unknown): TagId | null {
  try {
    return toTagId(value);
  } catch {
    return null;
  }
}

export function toUserIdSafe(value: unknown): UserId | null {
  try {
    return toUserId(value);
  } catch {
    return null;
  }
}

export function toConversationIdSafe(value: unknown): ConversationId | null {
  try {
    return toConversationId(value);
  } catch {
    return null;
  }
}

export function toActivityIdSafe(value: unknown): ActivityId | null {
  try {
    return toActivityId(value);
  } catch {
    return null;
  }
}

// ============================================================================
// Unsafe Conversions - Use with caution (for database layer only)
// ============================================================================

/**
 * Unsafe conversion from number to TopicId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToTopicId(value: number): TopicId {
  return value as TopicId;
}

/**
 * Unsafe conversion from number to ReplyId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToReplyId(value: number): ReplyId {
  return value as ReplyId;
}

/**
 * Unsafe conversion from number to CategoryId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToCategoryId(value: number): CategoryId {
  return value as CategoryId;
}

/**
 * Unsafe conversion from number to TagId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToTagId(value: number): TagId {
  return value as TagId;
}

/**
 * Unsafe conversion from number to UserId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToUserId(value: number): UserId {
  return value as UserId;
}

/**
 * Unsafe conversion from number to ConversationId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToConversationId(value: number): ConversationId {
  return value as ConversationId;
}

/**
 * Unsafe conversion from number to ActivityId
 * Use only in database repositories where you're certain the value is valid
 */
export function unsafeToActivityId(value: number): ActivityId {
  return value as ActivityId;
}
