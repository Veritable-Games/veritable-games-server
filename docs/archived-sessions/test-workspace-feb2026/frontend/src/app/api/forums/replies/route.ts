/**
 * Forum Replies API
 *
 * GET /api/forums/replies?topic_id=123 - List replies for a topic
 * POST /api/forums/replies - Create new reply
 *
 * Returns:
 * - success: boolean
 * - data: { replies: ForumReply[] } | { reply: ForumReply }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, rateLimiters, getClientIP } from '@/lib/security/middleware';
import { ReplyRepository } from '@/lib/forums/repositories/reply-repository';
import { TopicRepository } from '@/lib/forums/repositories/topic-repository';
import { TopicId, ReplyId, UserId } from '@/lib/forums/types';
import {
  errorResponse,
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ForumServiceUtils } from '@/lib/forums/services';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { MentionService } from '@/lib/notifications/mentions';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/replies?topic_id=123
 *
 * Lists all replies for a topic
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const topicIdStr = searchParams.get('topic_id');

    if (!topicIdStr) {
      throw new ValidationError('topic_id query parameter is required');
    }

    const topicId = parseInt(topicIdStr, 10);
    if (isNaN(topicId)) {
      throw new ValidationError('Invalid topic_id');
    }

    // Get current user for vote data (optional - guests can view replies)
    const user = await getCurrentUser(request);

    const replyRepo = new ReplyRepository();

    // Fetch replies for topic (returns tree structure with vote data if user logged in)
    const result = await replyRepo.getReplyTree(topicId as TopicId, {
      currentUserId: user?.id as UserId | undefined,
    });

    if (result.isErr()) {
      const err = result.error;
      throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        replies: result.value,
      },
    });
  } catch (error) {
    logger.error('Error fetching replies:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/forums/replies
 *
 * Creates a new reply
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
      const { topic_id, parent_id, content } = body;

      // Debug logging
      logger.info('[API] POST /api/forums/replies - Received:', {
        topic_id,
        parent_id,
        parent_id_type: typeof parent_id,
        content_length: content?.length || 0,
      });

      // 3. Validate required fields
      if (!topic_id || typeof topic_id !== 'number') {
        throw new ValidationError('topic_id is required and must be a number');
      }
      if (!content || typeof content !== 'string') {
        throw new ValidationError('content is required');
      }
      if (content.trim().length < 1) {
        throw new ValidationError('Content cannot be empty');
      }

      // Validate parent_id if provided
      if (parent_id !== undefined && parent_id !== null && typeof parent_id !== 'number') {
        throw new ValidationError('parent_id must be a number when provided');
      }

      // 4. Verify topic exists
      const topicRepo = new TopicRepository();
      const topicResult = await topicRepo.findById(topic_id as TopicId);

      if (topicResult.isErr()) {
        const err = topicResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!topicResult.value) {
        throw new NotFoundError('Topic', topic_id);
      }

      // Check if topic is locked
      if (topicResult.value.is_locked) {
        throw new ValidationError('This topic is locked and cannot receive new replies');
      }

      // 5. Sanitize user content to prevent XSS attacks
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

      // 6. Create reply via repository
      const replyRepo = new ReplyRepository();

      const result = await replyRepo.create({
        topic_id: topic_id as TopicId,
        parent_id: parent_id ? (parent_id as ReplyId) : null,
        author_id: user.id as UserId,
        content: sanitizedContent,
      });

      if (result.isErr()) {
        const err = result.error;
        throw new ValidationError(
          err.type === 'database' ? err.message : `Repository error: ${err.type}`
        );
      }

      // Process @mentions in the reply content (creates notifications)
      try {
        await MentionService.processMentions(
          sanitizedContent,
          user.id,
          'reply',
          result.value.id as number,
          topicResult.value.title // Use topic title as context
        );
      } catch (mentionError) {
        // Log but don't fail the request - mentions are nice-to-have
        logger.error('Error processing mentions:', mentionError);
      }

      // Invalidate stats cache after creating new reply
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json(
        {
          success: true,
          data: {
            reply: result.value,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      logger.error('Error creating reply:', error);
      return errorResponse(error);
    }
  },
  {
    rateLimiter: rateLimiters.replyCreate,
    rateLimiterType: 'replyCreate',
    rateLimitKey: req => `reply:create:${getClientIP(req)}`,
  }
);
