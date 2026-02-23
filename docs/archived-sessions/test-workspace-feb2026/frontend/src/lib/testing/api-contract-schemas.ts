/**
 * API Contract Validation Schemas
 *
 * Defines the IMMUTABLE API contract that the frontend depends on.
 * These schemas validate that API responses maintain backward compatibility.
 *
 * ⚠️ WARNING: Changes to these schemas are BREAKING CHANGES
 *
 * The frontend is tightly coupled to these response structures. Any changes
 * will cause runtime errors in the UI. Before modifying:
 * 1. Update all affected frontend components
 * 2. Run full integration tests
 * 3. Consider versioning the API instead
 */

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Base Types
// ============================================================================

/**
 * Category schema - used in topic responses
 */
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  topic_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * User schema - used in topic and reply responses
 */
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(), // Only for authenticated user
  avatar_url: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Nested reply schema - CRITICAL for frontend
 *
 * The frontend requires this exact structure for the reply tree.
 * Changing this will break the entire forum UI.
 */
export const ReplySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.number(),
    topic_id: z.number(),
    user_id: z.number(),
    content: z.string(),
    parent_id: z.number().nullable(),
    is_solution: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    vote_score: z.number(),

    // User data (joined)
    username: z.string(),
    avatar_url: z.string().nullable(),

    // CRITICAL: Nested replies array
    replies: z.array(ReplySchema).optional(),
  })
);

/**
 * Topic schema with joined category data
 *
 * ⚠️ CRITICAL: Frontend expects category_name, category_slug, category_color
 * These must be joined from the categories table.
 */
export const TopicSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  category_id: z.string(),
  user_id: z.number(),
  is_pinned: z.boolean(),
  is_locked: z.boolean(),
  is_solved: z.boolean(),
  reply_count: z.number(),
  view_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
  vote_score: z.number(),

  // CRITICAL: Joined category data
  category_name: z.string(),
  category_slug: z.string(),
  category_color: z.string(),

  // User data (joined)
  username: z.string(),
  avatar_url: z.string().nullable(),
});

/**
 * Topic with replies - full topic page response
 */
export const TopicWithRepliesSchema = TopicSchema.extend({
  // CRITICAL: Nested reply structure
  replies: z.array(ReplySchema),
});

// ============================================================================
// API Response Schemas (IMMUTABLE CONTRACT)
// ============================================================================

/**
 * GET /api/forums/categories
 */
export const GetCategoriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    categories: z.array(CategorySchema),
  }),
});

/**
 * GET /api/forums/categories/[slug]
 */
export const GetCategoryResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    category: CategorySchema,
    topics: z.array(TopicSchema),
  }),
});

/**
 * GET /api/forums/topics/[id]
 *
 * ⚠️ CRITICAL: This is the most important contract
 * The frontend TopicView component depends on this exact structure
 */
export const GetTopicResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    topic: TopicWithRepliesSchema,
  }),
});

/**
 * POST /api/forums/topics
 */
export const CreateTopicResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    topic: TopicSchema,
  }),
});

/**
 * Single reply schema (without nested replies)
 * Used for creation and update responses
 */
export const SingleReplySchema = z.object({
  id: z.number(),
  topic_id: z.number(),
  user_id: z.number(),
  content: z.string(),
  parent_id: z.number().nullable(),
  is_solution: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  vote_score: z.number(),

  // User data (joined)
  username: z.string(),
  avatar_url: z.string().nullable(),
});

/**
 * POST /api/forums/replies
 */
export const CreateReplyResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    reply: SingleReplySchema,
  }),
});

/**
 * PUT /api/forums/topics/[id]
 */
export const UpdateTopicResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    topic: TopicSchema,
  }),
});

/**
 * PUT /api/forums/replies/[id]
 */
export const UpdateReplyResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    reply: SingleReplySchema,
  }),
});

/**
 * DELETE /api/forums/topics/[id]
 */
export const DeleteTopicResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    deleted: z.boolean(),
  }),
});

/**
 * DELETE /api/forums/replies/[id]
 */
export const DeleteReplyResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    deleted: z.boolean(),
  }),
});

/**
 * GET /api/forums/search
 */
export const SearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(
      z.object({
        type: z.enum(['topic', 'reply']),
        id: z.number(),
        title: z.string().optional(),
        content: z.string(),
        category_name: z.string().optional(),
        username: z.string(),
        created_at: z.string(),
        rank: z.number(), // FTS5 rank
      })
    ),
    total: z.number(),
  }),
});

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Standard error response
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

// ============================================================================
// Contract Validation Function
// ============================================================================

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  endpoint: string;
}

/**
 * Validates an API response against its contract schema
 *
 * Usage:
 *   const result = validateContract(
 *     'GET /api/forums/topics/1',
 *     GetTopicResponseSchema,
 *     response
 *   );
 *
 *   if (!result.valid) {
 *     logger.error('Contract violation:', result.errors);
 *   }
 */
export function validateContract(
  endpoint: string,
  schema: z.ZodSchema,
  data: unknown
): ContractValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      endpoint,
    };
  }

  return {
    valid: false,
    errors: result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`),
    endpoint,
  };
}

/**
 * Assert that a response matches the contract (throws on violation)
 *
 * Usage in tests:
 *   assertContract('GET /api/forums/topics/1', GetTopicResponseSchema, response);
 */
export function assertContract(endpoint: string, schema: z.ZodSchema, data: unknown): void {
  const result = validateContract(endpoint, schema, data);

  if (!result.valid) {
    throw new Error(`Contract violation for ${endpoint}:\n${result.errors.join('\n')}`);
  }
}
