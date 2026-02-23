/**
 * Forum Topic by ID API
 *
 * GET /api/forums/topics/[id] - Get single topic with replies
 * PATCH /api/forums/topics/[id] - Update topic
 * DELETE /api/forums/topics/[id] - Delete topic (soft delete)
 *
 * Returns:
 * - success: boolean
 * - data: { topic: ForumTopic } | { message: string }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { TopicRepository } from '@/lib/forums/repositories/topic-repository';
import { TopicId } from '@/lib/forums/types';
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ForumServiceUtils } from '@/lib/forums/services';
import { sanitizeHtml, sanitizeTitle } from '@/lib/utils/sanitize';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/topics/[id]
 *
 * Fetches a single topic by ID
 */
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const params = await context.params;
      const topicId = parseInt(params.id, 10);

      if (isNaN(topicId)) {
        throw new ValidationError('Invalid topic ID');
      }

      const topicRepo = new TopicRepository();

      // Fetch topic with author info
      const result = await topicRepo.findById(topicId as TopicId, {
        include_author: true,
      });

      if (result.isErr()) {
        const err = result.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!result.value) {
        throw new NotFoundError('Topic', topicId);
      }

      return NextResponse.json({
        success: true,
        data: {
          topic: result.value,
        },
      });
    } catch (error) {
      logger.error('Error fetching topic:', error);
      return errorResponse(error);
    }
  }
);

/**
 * PATCH /api/forums/topics/[id]
 *
 * Updates a topic (title, content)
 */
export const PATCH = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // 1. Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      const params = await context.params;
      const topicId = parseInt(params.id, 10);

      if (isNaN(topicId)) {
        throw new ValidationError('Invalid topic ID');
      }

      // 2. Fetch existing topic
      const topicRepo = new TopicRepository();

      const topicResult = await topicRepo.findById(topicId as TopicId);

      if (topicResult.isErr()) {
        const err = topicResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!topicResult.value) {
        throw new NotFoundError('Topic', topicId);
      }

      // 3. Check authorization (owner or moderator)
      const topic = topicResult.value;
      if (topic.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError('You do not have permission to edit this topic');
      }

      // 4. Parse and validate update data
      const body = await request.json();
      const { title, content } = body;

      if (title !== undefined && (typeof title !== 'string' || title.trim().length < 3)) {
        throw new ValidationError('Title must be at least 3 characters');
      }
      if (content !== undefined && (typeof content !== 'string' || content.trim().length < 1)) {
        throw new ValidationError('Content is required');
      }

      // 5. Sanitize user content to prevent XSS attacks
      const updateData: any = {};
      if (title) {
        updateData.title = sanitizeTitle(title.trim());
      }
      if (content) {
        updateData.content = sanitizeHtml(content.trim(), {
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
      }

      // 7. Update topic via repository
      const updateResult = await topicRepo.update(topicId as TopicId, updateData);

      if (updateResult.isErr()) {
        const err = updateResult.error;
        throw new ValidationError(
          err.type === 'database' ? err.message : `Repository error: ${err.type}`
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          topic: updateResult.value,
        },
      });
    } catch (error) {
      logger.error('Error updating topic:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);

/**
 * DELETE /api/forums/topics/[id]
 *
 * Deletes a topic (soft delete)
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // 1. Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      const params = await context.params;
      const topicId = parseInt(params.id, 10);

      if (isNaN(topicId)) {
        throw new ValidationError('Invalid topic ID');
      }

      // 2. Fetch existing topic
      const topicRepo = new TopicRepository();

      const topicResult = await topicRepo.findById(topicId as TopicId);

      if (topicResult.isErr()) {
        const err = topicResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!topicResult.value) {
        throw new NotFoundError('Topic', topicId);
      }

      // 3. Check authorization (owner or moderator)
      const topic = topicResult.value;
      if (topic.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError('You do not have permission to delete this topic');
      }

      // 4. Soft delete via repository
      const deleteResult = await topicRepo.delete(topicId as TopicId);

      if (deleteResult.isErr()) {
        const err = deleteResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      // Invalidate stats cache after deleting topic
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json({
        success: true,
        data: {
          message: 'Topic deleted successfully',
        },
      });
    } catch (error) {
      logger.error('Error deleting topic:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);
