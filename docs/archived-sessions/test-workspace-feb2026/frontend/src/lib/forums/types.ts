/**
 * Forum System Types
 *
 * MIGRATION NOTICE: This file is being migrated to use branded types.
 * New code should use branded types from './branded-types.ts'.
 * Existing code will continue to work during the migration period.
 */

import type {
  TopicId,
  ReplyId,
  CategoryId,
  TagId,
  UserId,
  ConversationId,
  ActivityId,
} from './branded-types';

// Re-export branded types so other modules can import them from this file
export type {
  TopicId,
  ReplyId,
  CategoryId,
  TagId,
  UserId,
  ConversationId,
  ActivityId,
} from './branded-types';

// ============================================================================
// Core Entity Interfaces (with branded types)
// ============================================================================

/**
 * Forum Section
 * Groups multiple categories together with custom ordering
 */
export interface ForumSection {
  id: string; // Section identifier (e.g., 'general', 'games', 'autumn')
  display_name: string; // Display name (e.g., 'Social Contract', 'Noxii Game')
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Forum Category
 */
export interface ForumCategory {
  id: CategoryId; // Branded type for compile-time safety
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  section: string;
  is_public?: boolean; // Visibility control: true = public, false/0 = admin-only
  topic_count: number;
  post_count: number;
  last_activity_at?: string;
  created_at: string;
}

/**
 * Topic Status Type - Bit Flags
 *
 * Changed from string enum to number for bit flag support.
 * Each status is now a bit flag that can be combined:
 * - 1 = Locked
 * - 2 = Pinned
 * - 4 = Solved
 * - 8 = Archived
 * - etc.
 *
 * Example: A topic that is both pinned and solved = 6 (2 | 4)
 */
export type TopicStatus = number;

/**
 * Forum Topic
 *
 * Note: Boolean fields (is_pinned, is_locked, is_solved) are computed properties
 * derived from the status bit flags. They are not stored in the database.
 */
export interface ForumTopic {
  id: TopicId; // Branded type
  category_id: CategoryId; // Branded type
  title: string;
  content: string;

  /**
   * Status as bit flags (INTEGER in database)
   * Use functions from status-flags.ts to check/modify:
   * - hasFlag(status, TopicStatusFlags.PINNED)
   * - addFlag(status, TopicStatusFlags.SOLVED)
   * etc.
   */
  status: TopicStatus;

  view_count: number;
  reply_count: number;
  user_id: UserId; // Branded type
  username?: string;
  author?: ForumUser; // Populated by repository when fetching with author info
  created_at: string;
  updated_at: string;
  last_reply_at?: string;
  last_reply_user_id?: UserId; // Branded type
  last_reply_username?: string;

  // Category information
  category_name?: string;
  category_color?: string;
  category_slug?: string;

  // Computed properties (derived from status bit flags)
  // These are populated by repository transformTopic() method
  is_pinned?: boolean;
  is_locked?: boolean;
  is_solved?: boolean;
  is_archived?: boolean;
  is_featured?: boolean;
}

/**
 * Forum Reply
 */
export interface ForumReply {
  id: ReplyId; // Branded type
  topic_id: TopicId; // Branded type
  content: string;
  is_solution: boolean;
  is_deleted?: boolean;
  parent_id?: ReplyId; // Branded type
  user_id: UserId; // Branded type
  username?: string;
  display_name?: string;
  author?: ForumUser; // Populated by repository when fetching with author info
  created_at: string;
  updated_at: string;
  replies?: ForumReply[]; // Nested replies (legacy, use children instead)
  children?: ForumReply[]; // Nested replies (from getReplyTree)

  // Voting system fields
  vote_count?: number; // Total vote score (upvotes - downvotes)
  user_vote?: 'up' | 'down' | null; // Current user's vote on this reply

  // Materialized metadata fields (from database migration)
  // Note: conversation_id and participant_hash are populated by database triggers
  // but not actively used by the UI. Kept for backward compatibility.
  conversation_id?: ConversationId; // Branded type
  reply_depth?: number; // Used for indentation/nesting level
  thread_root_id?: ReplyId; // Branded type - used for threading
  participant_hash?: string; // Reserved for future use
}

/**
 * Forum Tag
 */
export interface ForumTag {
  id: TagId; // Branded type
  name: string;
  slug: string;
  description?: string;
  color?: string;
  usage_count: number;
  created_at: string;
}

// ============================================================================
// Data Transfer Objects (DTOs) - API request/response types
// ============================================================================

/**
 * Create Topic Data
 */
export interface CreateTopicData {
  category_id: CategoryId; // Branded type
  title: string;
  content: string;
  /**
   * Initial status flags (default is 0 = open)
   * Use TopicStatusFlags constants to set flags:
   * status: TopicStatusFlags.PINNED | TopicStatusFlags.SOLVED
   */
  status?: TopicStatus;
  tags?: TagId[]; // Branded type array
}

/**
 * Update Topic Data
 *
 * Note: For moderation actions (lock, pin, solve), use the dedicated
 * moderation service methods instead of directly updating status.
 * This ensures proper activity logging and cache invalidation.
 */
export interface UpdateTopicData {
  title?: string;
  content?: string;
  /**
   * New status flags
   * Use bit flag helper functions to modify:
   * - addFlag(status, TopicStatusFlags.LOCKED)
   * - removeFlag(status, TopicStatusFlags.PINNED)
   * etc.
   */
  status?: TopicStatus;
  tags?: TagId[]; // Branded type array
}

/**
 * Create Reply Data
 */
export interface CreateReplyData {
  topic_id: TopicId; // Branded type
  content: string;
  parent_id?: ReplyId; // Branded type
  is_solution?: boolean;
}

/**
 * Update Reply Data
 */
export interface UpdateReplyData {
  content?: string;
  is_solution?: boolean;
}

/**
 * Create Category Data
 */
export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  section?: string;
  sort_order?: number;
  is_public?: boolean;
}

/**
 * Update Category Data
 */
export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  section?: string;
  sort_order?: number;
  is_public?: boolean;
}

// ============================================================================
// Search & Query Options
// ============================================================================

/**
 * Forum Search Options
 */
export interface ForumSearchOptions {
  query?: string;
  category_id?: CategoryId; // Branded type
  category_slug?: string; // Category slug filter
  user_id?: UserId; // Branded type
  status?: TopicStatus;
  tag_ids?: TagId[]; // Branded type array
  limit?: number;
  offset?: number;
  sort?: 'recent' | 'popular' | 'oldest' | 'replies';
}

/**
 * Forum Statistics
 */
export interface ForumStats {
  total_topics: number;
  total_replies: number;
  total_users: number;
  active_users_today: number;
  recent_topics: ForumTopic[];
  popular_categories: ForumCategory[];
}

// ============================================================================
// Composite Types
// ============================================================================

/**
 * Topic with Replies
 */
export interface TopicWithReplies extends ForumTopic {
  replies: ForumReply[];
  is_locked?: boolean;
}

// ============================================================================
// Activity Tracking Types
// ============================================================================

/**
 * Activity Type
 */
export type ActivityType =
  | 'topic_created'
  | 'reply_created'
  | 'topic_updated'
  | 'reply_updated'
  | 'solution_marked';

/**
 * Entity Type
 */
export type EntityType = 'topic' | 'reply';

/**
 * Forum Activity
 */
export interface ForumActivity {
  id: ActivityId; // Branded type
  user_id: UserId; // Branded type
  activity_type: ActivityType;
  entity_id: number; // Generic number for flexibility (could be TopicId or ReplyId)
  entity_type: EntityType;
  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// Service Error Types (for Result pattern)
// ============================================================================

/**
 * Base Service Error
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SERVICE_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Database Error
 */
export class DatabaseError extends ServiceError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends ServiceError {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', fieldErrors);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ServiceError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string | number
  ) {
    super(`${entityType} with ID ${entityId} not found`, 'NOT_FOUND', { entityType, entityId });
    this.name = 'NotFoundError';
  }
}

/**
 * Permission Error
 */
export class PermissionError extends ServiceError {
  constructor(
    message: string = 'You do not have permission to perform this action',
    public readonly requiredPermission?: string
  ) {
    super(message, 'PERMISSION_DENIED', { requiredPermission });
    this.name = 'PermissionError';
  }
}

/**
 * Conflict Error (e.g., duplicate entry)
 */
export class ConflictError extends ServiceError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends ServiceError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// Type Guards (for discriminating union types)
// ============================================================================

/**
 * Type guard to check if error is a ServiceError
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/**
 * Type guard to check if error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard to check if error is a PermissionError
 */
export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

// ============================================================================
// Legacy Compatibility Exports
// ============================================================================

/**
 * DEPRECATED: Legacy types for backward compatibility
 * New code should use branded types directly
 */

// These allow gradual migration from number/string to branded types
export type LegacyTopicId = number;
export type LegacyReplyId = number;
export type LegacyCategoryId = string;
export type LegacyTagId = number;
export type LegacyUserId = number;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial update type helper
 */
export type PartialUpdate<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Required fields type helper
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Omit multiple fields type helper
 */
export type OmitMultiple<T, K extends keyof T> = Omit<T, K>;

/**
 * Database row type (before transformation to branded types)
 */
export type DatabaseRow<T> = {
  [P in keyof T]: T[P] extends TopicId | ReplyId | TagId | UserId | ActivityId
    ? number
    : T[P] extends CategoryId | ConversationId
      ? string
      : T[P];
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Success Response
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Error Response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * API Response (union type)
 */
export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Pagination Metadata (standalone)
 */
export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Content Format Types
 */
export type ContentFormat = 'markdown' | 'html' | 'plaintext';

/**
 * Reply Filter Options
 */
export interface ReplyFilterOptions {
  max_depth?: number;
  solutions_only?: boolean;
  sort_by?: 'path' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  current_user_id?: UserId; // For fetching user's vote on each reply
}

/**
 * Search Result DTO (Data Transfer Object)
 */
export interface SearchResultDTO {
  id: number;
  content_type: 'topic' | 'reply';
  title: string;
  content: string;
  author_username: string;
  category_name?: string;
  created_at: string;
  updated_at?: string;
  topic_id: number;
  reply_count?: number;
  view_count?: number;
  is_locked?: boolean;
  is_pinned?: boolean;
  is_solved?: boolean;
  is_archived?: boolean;
  highlight?: string;
  rank?: number;
}

// ============================================================================
// Type Aliases for Backward Compatibility
// ============================================================================

/**
 * Backward compatible aliases for old naming convention
 */
export type CreateTopicDTO = CreateTopicData;
export type UpdateTopicDTO = UpdateTopicData;
export type CreateReplyDTO = CreateReplyData;
export type UpdateReplyDTO = UpdateReplyData;

// ============================================================================
// Additional Type Exports for Phase 2.1
// ============================================================================

export type ForumId = number;
export type SortOrder = 'asc' | 'desc';
export type SearchScope = 'topics' | 'replies' | 'all';

export interface ForumUser {
  id: UserId;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface TopicFilterOptions {
  category_id?: CategoryId;
  status?: TopicStatus;
  author_id?: UserId;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_solved?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: SortOrder;
  pinned_only?: boolean;
  solved_only?: boolean;
  locked_only?: boolean;
}

export interface SearchQueryDTO {
  query: string;
  scope?: SearchScope;
  category_id?: CategoryId;
  limit?: number;
  offset?: number;
}

export interface CategoryStats {
  category_id: CategoryId;
  topic_count: number;
  reply_count: number;
  view_count: number;
  last_activity_at?: string;
}

export interface UserForumStats {
  user_id: UserId;
  topic_count: number;
  reply_count: number;
  solution_count: number;
}

export interface ModerationAction {
  action_type: 'lock' | 'unlock' | 'pin' | 'unpin' | 'delete' | 'restore';
  target_type: 'topic' | 'reply';
  target_id: number;
  moderator_id: UserId;
  reason?: string;
  timestamp: string;
}
