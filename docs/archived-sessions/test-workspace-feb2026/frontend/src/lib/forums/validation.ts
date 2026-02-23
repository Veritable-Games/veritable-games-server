/**
 * Forum System Validation Schemas
 *
 * Comprehensive Zod validation schemas for all forum operations including:
 * - Input validation (create/update DTOs)
 * - Sanitization helpers (title, content, tags)
 * - Validation functions with Result pattern
 * - Request parsing utilities
 *
 * All validations follow the constraints:
 * - Title: 3-200 characters
 * - Topic content: min 1 char (content required)
 * - Reply content: min 1 char
 * - Tags: max 10 per topic
 * - Reply depth: max 5 levels
 * - Search query: min 2 chars
 *
 * @module lib/forums/validation
 */

import { z } from 'zod';
import { Result, Ok, Err } from '@/lib/utils/result';
import type {
  TopicId,
  ReplyId,
  CategoryId,
  TopicStatus,
  SortOrder,
  SearchScope,
  ContentFormat,
  CreateTopicDTO,
  UpdateTopicDTO,
  CreateReplyDTO,
  UpdateReplyDTO,
  SearchQueryDTO,
} from './types';
import { toTopicId, toReplyId, toCategoryId } from './branded-helpers';
import { logger } from '@/lib/utils/logger';

// DOMPurify dynamic import to avoid HMR issues
let DOMPurify: any = null;

async function initDOMPurify() {
  if (DOMPurify) return DOMPurify;

  if (typeof window === 'undefined') {
    // Server-side: use isomorphic-dompurify
    const { default: isomorphicDOMPurify } = await import('isomorphic-dompurify');
    DOMPurify = isomorphicDOMPurify;
  } else {
    // Client-side: use dompurify
    const { default: clientDOMPurify } = await import('dompurify');
    DOMPurify = clientDOMPurify;
  }

  return DOMPurify;
}

// ============================================================================
// Constants
// ============================================================================

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const TOPIC_CONTENT_MIN_LENGTH = 1;
const REPLY_CONTENT_MIN_LENGTH = 1;
const MAX_TAGS_PER_TOPIC = 10;
const MAX_REPLY_DEPTH = 5;
const SEARCH_QUERY_MIN_LENGTH = 2;
const PAGINATION_MAX_LIMIT = 100;
const TAG_MAX_LENGTH = 50;

// ============================================================================
// Base Schemas (Reusable Components)
// ============================================================================

/**
 * Topic status enum schema
 */
const TopicStatusSchema = z.enum(['open', 'solved', 'closed']);

/**
 * Sort order enum schema
 */
const SortOrderSchema = z.enum(['latest', 'oldest', 'popular', 'active']);

/**
 * Search scope enum schema
 */
const SearchScopeSchema = z.enum(['topics', 'replies', 'all']);

/**
 * Content format enum schema
 */
const ContentFormatSchema = z.enum(['markdown', 'html', 'plaintext']);

/**
 * Pagination schema (reusable)
 */
const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(20),
});

/**
 * Tag array schema
 * - Max 10 tags per topic
 * - Each tag must be 1-50 characters
 * - Automatically normalized to lowercase and trimmed
 */
const TagArraySchema = z
  .array(
    z
      .string()
      .min(1, 'Tag cannot be empty')
      .max(TAG_MAX_LENGTH, `Tag must be at most ${TAG_MAX_LENGTH} characters`)
      .transform(tag => tag.toLowerCase().trim())
  )
  .max(MAX_TAGS_PER_TOPIC, `Maximum ${MAX_TAGS_PER_TOPIC} tags allowed`)
  .optional();

// ============================================================================
// Topic Validation Schemas
// ============================================================================

/**
 * Create topic schema
 *
 * Validates all required fields for creating a new topic:
 * - Title: 3-200 characters, trimmed and sanitized
 * - Content: min 1 character (content required, after sanitization)
 * - Category ID: required positive integer
 * - Tags: optional, max 10
 *
 * IMPORTANT: Validation happens AFTER sanitization to prevent XSS bypasses
 */
export const CreateTopicSchema = z.object({
  title: z
    .string()
    .min(TITLE_MIN_LENGTH, `Title must be at least ${TITLE_MIN_LENGTH} characters`)
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`),
  content: z.string().min(TOPIC_CONTENT_MIN_LENGTH, 'Content is required'),
  category_id: z
    .number()
    .int()
    .positive('Category ID must be a positive integer')
    .transform(toCategoryId),
  tags: TagArraySchema,
});

/**
 * Update topic schema
 *
 * All fields are optional (partial update)
 * Moderation fields (is_pinned, is_locked) require admin/moderator privileges
 *
 * IMPORTANT: Validation happens AFTER sanitization to prevent XSS bypasses
 */
export const UpdateTopicSchema = z.object({
  title: z
    .string()
    .min(TITLE_MIN_LENGTH, `Title must be at least ${TITLE_MIN_LENGTH} characters`)
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`)
    .optional(),
  content: z.string().min(TOPIC_CONTENT_MIN_LENGTH, 'Content is required').optional(),
  category_id: z
    .number()
    .int()
    .positive('Category ID must be a positive integer')
    .transform(toCategoryId)
    .optional(),
  tags: TagArraySchema,
  status: TopicStatusSchema.optional(),
  is_pinned: z.boolean().optional(),
  is_locked: z.boolean().optional(),
});

// ============================================================================
// Reply Validation Schemas
// ============================================================================

/**
 * Create reply schema
 *
 * Validates reply creation:
 * - Content: min 1 character (replies can be short, after sanitization)
 * - Topic ID: required positive integer
 * - Parent ID: optional for nested replies
 *
 * IMPORTANT: Validation happens AFTER sanitization to prevent XSS bypasses
 */
export const CreateReplySchema = z.object({
  topic_id: z.number().int().positive('Topic ID must be a positive integer').transform(toTopicId),
  parent_id: z
    .number()
    .int()
    .positive('Parent ID must be a positive integer')
    .transform(toReplyId)
    .nullable()
    .optional(),
  content: z.string().min(REPLY_CONTENT_MIN_LENGTH, 'Reply content cannot be empty'),
});

/**
 * Update reply schema
 *
 * Only content and solution status can be updated
 * Solution marking requires topic author or moderator privileges
 *
 * IMPORTANT: Validation happens AFTER sanitization to prevent XSS bypasses
 */
export const UpdateReplySchema = z.object({
  content: z.string().min(REPLY_CONTENT_MIN_LENGTH, 'Reply content cannot be empty').optional(),
  is_solution: z.boolean().optional(),
});

// ============================================================================
// Search and Query Schemas
// ============================================================================

/**
 * Search query schema
 *
 * Validates full-text search queries with filtering options
 */
export const SearchQuerySchema = z.object({
  query: z
    .string()
    .min(
      SEARCH_QUERY_MIN_LENGTH,
      `Search query must be at least ${SEARCH_QUERY_MIN_LENGTH} characters`
    )
    .transform(q => q.trim()),
  scope: SearchScopeSchema.default('all'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  sort: SortOrderSchema.default('latest'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(20),
});

/**
 * Topic list query schema
 *
 * Validates topic list filtering and pagination
 */
export const TopicListQuerySchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  status: TopicStatusSchema.optional(),
  pinned_only: z.boolean().default(false),
  solved_only: z.boolean().default(false),
  sort: SortOrderSchema.default('latest'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(20),
});

// ============================================================================
// Sanitization Helpers
// ============================================================================

/**
 * Sanitize topic/reply title
 *
 * - Trims whitespace
 * - Normalizes multiple spaces to single space
 * - Removes line breaks
 * - Removes HTML tags
 *
 * @param title - Raw title string
 * @returns Sanitized title
 */
export function sanitizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .replace(/[\r\n]+/g, ' ') // Remove line breaks
    .replace(/<[^>]*>/g, ''); // Remove HTML tags
}

/**
 * DOMPurify config for Markdown content
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Text formatting
    'b',
    'i',
    'em',
    'strong',
    'u',
    's',
    'del',
    'mark',
    'code',
    'pre',
    'kbd',
    'samp',
    'var',
    'sub',
    'sup',
    // Structure
    'p',
    'br',
    'hr',
    'blockquote',
    'div',
    'span',
    // Lists
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    // Tables
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Links
    'a',
    // Media (restricted via ALLOWED_ATTR)
    'img',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'title',
    'alt',
    'src',
    'width',
    'height',
    'class',
    'id',
    // Table attributes
    'colspan',
    'rowspan',
    'align',
    'valign',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|#|\/)/i, // Only safe protocols
  KEEP_CONTENT: true, // Preserve text content when removing tags
};

/**
 * Basic HTML stripping fallback (when DOMPurify is not loaded)
 *
 * IMPORTANT: This is a FALLBACK ONLY. Production should always use DOMPurify.
 * Removes:
 * - Script tags
 * - Style tags
 * - Iframe tags
 * - Event handlers (onclick, onload, etc.)
 * - Dangerous protocol URLs (javascript:, data:, vbscript:)
 */
function basicSanitize(content: string): string {
  // Log warning in production if this fallback is used
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    logger.error('SECURITY WARNING: Using basic sanitization fallback instead of DOMPurify');
  }

  return (
    content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      // CRITICAL: Remove dangerous protocol URLs (XSS prevention)
      .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="#"')
      .replace(/src\s*=\s*["']?\s*javascript:/gi, 'src="#"')
      .replace(/href\s*=\s*["']?\s*data:/gi, 'href="#"')
      .replace(/href\s*=\s*["']?\s*vbscript:/gi, 'href="#"')
      .trim()
  );
}

/**
 * Sanitize content (Markdown/HTML) - Async version with proper DOMPurify initialization
 *
 * - Preserves Markdown syntax
 * - Removes dangerous HTML (scripts, iframes, etc.)
 * - Allows safe HTML tags (for rich text)
 *
 * Uses DOMPurify with Markdown-friendly configuration
 *
 * @param content - Raw content string
 * @returns Promise resolving to sanitized content
 */
export async function sanitizeContentAsync(content: string): Promise<string> {
  const purify = await initDOMPurify();
  return purify.sanitize(content, DOMPURIFY_CONFIG).trim();
}

/**
 * Sanitize content (Markdown/HTML) - Synchronous version with fallback
 *
 * - Preserves Markdown syntax
 * - Removes dangerous HTML (scripts, iframes, etc.)
 * - Allows safe HTML tags (for rich text)
 *
 * NOTE: If DOMPurify is not yet loaded, uses basic fallback sanitization.
 * For better security, use sanitizeContentAsync() instead.
 *
 * @param content - Raw content string
 * @returns Sanitized content
 */
export function sanitizeContent(content: string): string {
  if (!DOMPurify) {
    logger.warn(
      'DOMPurify not loaded, using basic sanitization. Consider using sanitizeContentAsync().'
    );
    return basicSanitize(content);
  }

  return DOMPurify.sanitize(content, DOMPURIFY_CONFIG).trim();
}

/**
 * Normalize tag name
 *
 * - Converts to lowercase
 * - Trims whitespace
 * - Converts spaces to hyphens (slug format)
 * - Removes special characters except hyphens
 *
 * @param tag - Raw tag string
 * @returns Normalized tag slug
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special chars
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// ============================================================================
// Validation Functions (Result Pattern)
// ============================================================================

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validate topic title
 *
 * Ensures title meets length and content requirements
 *
 * @param title - Title to validate
 * @returns Result with sanitized title or validation error
 */
export function validateTopicTitle(title: string): Result<string, ValidationError> {
  const sanitized = sanitizeTitle(title);

  // Check empty first (before length check)
  if (sanitized.trim().length === 0) {
    return Err({
      field: 'title',
      message: 'Title cannot be empty or whitespace only',
      code: 'TITLE_EMPTY',
    });
  }

  if (sanitized.length < TITLE_MIN_LENGTH) {
    return Err({
      field: 'title',
      message: `Title must be at least ${TITLE_MIN_LENGTH} characters`,
      code: 'TITLE_TOO_SHORT',
    });
  }

  if (sanitized.length > TITLE_MAX_LENGTH) {
    return Err({
      field: 'title',
      message: `Title must be at most ${TITLE_MAX_LENGTH} characters`,
      code: 'TITLE_TOO_LONG',
    });
  }

  return Ok(sanitized);
}

/**
 * Validate reply depth
 *
 * Ensures reply nesting doesn't exceed maximum depth (5 levels)
 *
 * @param parentId - Parent reply ID (if any)
 * @param currentDepth - Current depth in reply tree (optional, for validation)
 * @returns Result with validated depth or error
 */
export function validateReplyDepth(
  parentId?: number | null,
  currentDepth?: number
): Result<number, ValidationError> {
  // Top-level reply (no parent)
  if (!parentId) {
    return Ok(0);
  }

  // If current depth is provided, check it
  const depth = currentDepth ?? 0;

  if (depth >= MAX_REPLY_DEPTH) {
    return Err({
      field: 'parent_id',
      message: `Maximum reply depth (${MAX_REPLY_DEPTH} levels) exceeded`,
      code: 'MAX_DEPTH_EXCEEDED',
    });
  }

  return Ok(depth + 1);
}

/**
 * Validate tags array
 *
 * Ensures tags meet count and format requirements
 *
 * @param tags - Array of tag strings
 * @returns Result with normalized tags or validation error
 */
export function validateTags(tags: string[]): Result<string[], ValidationError> {
  if (tags.length > MAX_TAGS_PER_TOPIC) {
    return Err({
      field: 'tags',
      message: `Maximum ${MAX_TAGS_PER_TOPIC} tags allowed`,
      code: 'TOO_MANY_TAGS',
    });
  }

  const normalized = tags.map(tag => normalizeTag(tag)).filter(tag => tag.length > 0); // Remove empty tags after normalization

  // Check for duplicates
  const unique = Array.from(new Set(normalized));
  if (unique.length !== normalized.length) {
    return Err({
      field: 'tags',
      message: 'Duplicate tags are not allowed',
      code: 'DUPLICATE_TAGS',
    });
  }

  // Check individual tag lengths
  for (const tag of normalized) {
    if (tag.length > TAG_MAX_LENGTH) {
      return Err({
        field: 'tags',
        message: `Tag "${tag}" exceeds maximum length of ${TAG_MAX_LENGTH} characters`,
        code: 'TAG_TOO_LONG',
      });
    }
  }

  return Ok(unique);
}

// ============================================================================
// Request Parser (Following Codebase Pattern)
// ============================================================================

/**
 * Safe request parser with Result pattern
 *
 * Parses and validates JSON request body using Zod schema
 * Returns detailed validation errors on failure
 *
 * @param request - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const bodyResult = await safeParseRequest(request, CreateTopicSchema);
 * if (bodyResult.isErr()) {
 *   return NextResponse.json({ error: bodyResult.error.message }, { status: 400 });
 * }
 * const topic = await createTopic(bodyResult.value);
 * ```
 */
export async function safeParseRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<Result<T, { message: string; details?: any }>> {
  let body: unknown;

  // Parse JSON body
  try {
    body = await request.json();
  } catch (error) {
    // JSON parsing error
    if (error instanceof SyntaxError) {
      return Err({
        message: 'Invalid JSON in request body',
        details: { error: error.message },
      });
    }

    // Other errors during parsing
    return Err({
      message: 'Failed to parse request body',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // Validate with Zod schema
  try {
    const result = schema.safeParse(body);

    if (!result.success) {
      // Format Zod errors for API response
      const details = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      return Err({
        message: 'Validation failed',
        details,
      });
    }

    return Ok(result.data);
  } catch (error) {
    // Unexpected validation error
    return Err({
      message: 'Validation error',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * Simple validation helper (non-Result pattern, for compatibility)
 *
 * Similar to workspace validation pattern
 *
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Success object with data or error object with messages
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(
    (err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`
  );

  return { success: false, errors };
}

// ============================================================================
// Type Exports (for convenience)
// ============================================================================

export type { CreateTopicDTO, UpdateTopicDTO, CreateReplyDTO, UpdateReplyDTO, SearchQueryDTO };
