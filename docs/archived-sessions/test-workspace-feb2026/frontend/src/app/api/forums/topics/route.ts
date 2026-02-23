/**
 * Forum Topics API
 *
 * GET /api/forums/topics?category=slug&page=1&limit=20 - List topics (optionally filtered by category)
 * POST /api/forums/topics - Create new topic
 *
 * Returns:
 * - success: boolean
 * - data: { topics: ForumTopic[], total?: number, page?: number, limit?: number } | { topic: ForumTopic }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, rateLimiters, getClientIP } from '@/lib/security/middleware';
import { TopicRepository } from '@/lib/forums/repositories/topic-repository';
import { CategoryRepository } from '@/lib/forums/repositories/category-repository';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ForumServiceUtils } from '@/lib/forums/services';
import { sanitizeHtml, sanitizeTitle } from '@/lib/utils/sanitize';
import { MentionService } from '@/lib/notifications/mentions';
import { toCategoryId, toUserId } from '@/lib/forums/branded-types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/topics
 *
 * Lists topics, optionally filtered by category
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const categorySlug = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const topicRepo = new TopicRepository();

    if (categorySlug) {
      // Get category by slug first
      const categoryRepo = new CategoryRepository();
      const categoryResult = await categoryRepo.findBySlug(categorySlug);

      if (categoryResult.isErr()) {
        const err = categoryResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!categoryResult.value) {
        throw new NotFoundError('Category', categorySlug);
      }

      const category = categoryResult.value;

      // Check category visibility: return 404 if hidden and user is not admin
      const user = await getCurrentUser(request);
      const userRole = user?.role || 'anonymous';

      if (!category.is_public && userRole !== 'admin') {
        // Return 404 to hide existence of hidden categories
        throw new NotFoundError('Category', categorySlug);
      }

      // Fetch topics for this category
      const result = await topicRepo.findByCategory(category.id, {
        page,
        limit,
      });

      if (result.isErr()) {
        const err = result.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      // result.value is already a PaginatedResponse with { success, data, pagination }
      return NextResponse.json({
        success: true,
        data: {
          topics: result.value.data,
          pagination: result.value.pagination,
        },
      });
    } else {
      // Fetch all recent topics (across all categories)
      // For now, return empty array - this would need a findAll method
      return NextResponse.json({
        success: true,
        data: {
          topics: [],
          page,
          limit,
          message: 'Use ?category=slug to filter by category',
        },
      });
    }
  } catch (error) {
    logger.error('Error fetching topics:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/forums/topics
 *
 * Creates a new topic
 */
export const POST = withSecurity(
  async (request: NextRequest) => {
    try {
      // 1. Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // 2. Parse request body
      const body = await request.json();
      const { title, content, category_id } = body;

      // 3. Validate required fields
      if (!title || typeof title !== 'string') {
        throw new ValidationError('Title is required');
      }
      if (!content || typeof content !== 'string') {
        throw new ValidationError('Content is required');
      }
      if (!category_id || typeof category_id !== 'number') {
        throw new ValidationError('Category ID is required');
      }

      // 4. Sanitize user content to prevent XSS attacks
      const sanitizedTitle = sanitizeTitle(title.trim());
      const sanitizedContent = sanitizeHtml(content.trim(), {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          'a',
          'ul',
          'ol',
          'li',
          'blockquote',
          'code',
          'pre',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
        ],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      });

      // 6. Create topic via repository
      const topicRepo = new TopicRepository();

      const result = await topicRepo.create({
        title: sanitizedTitle,
        content: sanitizedContent,
        category_id: toCategoryId(category_id), // Convert to branded type with validation
        author_id: toUserId(user.id), // Convert to branded type with validation
      });

      if (result.isErr()) {
        const err = result.error;
        throw new ValidationError(
          err.type === 'database' ? err.message : `Repository error: ${err.type}`
        );
      }

      // Process @mentions in the topic content (creates notifications)
      try {
        await MentionService.processMentions(
          sanitizedContent,
          user.id,
          'topic',
          result.value.id as number,
          sanitizedTitle
        );
      } catch (mentionError) {
        // Log but don't fail the request - mentions are nice-to-have
        logger.error('Error processing mentions:', mentionError);
      }

      // Invalidate stats cache after creating new topic
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json(
        {
          success: true,
          data: {
            topic: result.value,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      logger.error('Error creating topic:', error);
      return errorResponse(error);
    }
  },
  {
    rateLimiter: rateLimiters.topicCreate,
    rateLimiterType: 'topicCreate',
    rateLimitKey: req => `topic:create:${getClientIP(req)}`,
  }
);
