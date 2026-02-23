/**
 * Forum Reply by ID API
 *
 * GET /api/forums/replies/[id] - Get single reply
 * PATCH /api/forums/replies/[id] - Update reply
 * DELETE /api/forums/replies/[id] - Delete reply
 *
 * Returns:
 * - success: boolean
 * - data: { reply: ForumReply } | { message: string }
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { ReplyRepository } from '@/lib/forums/repositories/reply-repository';
import { ReplyId } from '@/lib/forums/types';
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ForumServiceUtils } from '@/lib/forums/services';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/forums/replies/[id]
 *
 * Fetches a single reply by ID
 */
export const GET = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const params = await context.params;
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      const replyRepo = new ReplyRepository();

      // Fetch reply with author info
      const result = await replyRepo.findById(replyId as ReplyId, true);

      if (result.isErr()) {
        const err = result.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!result.value) {
        throw new NotFoundError('Reply', replyId);
      }

      return NextResponse.json({
        success: true,
        data: {
          reply: result.value,
        },
      });
    } catch (error) {
      logger.error('Error fetching reply:', error);
      return errorResponse(error);
    }
  }
);

/**
 * PATCH /api/forums/replies/[id]
 *
 * Updates a reply (content only)
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
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      // 2. Fetch existing reply
      const replyRepo = new ReplyRepository();

      const replyResult = await replyRepo.findById(replyId as ReplyId);

      if (replyResult.isErr()) {
        const err = replyResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!replyResult.value) {
        throw new NotFoundError('Reply', replyId);
      }

      // 3. Check authorization (owner or moderator)
      const reply = replyResult.value;
      if (reply.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError('You do not have permission to edit this reply');
      }

      // 4. Parse and validate update data
      const body = await request.json();
      const { content } = body;

      if (content !== undefined && (typeof content !== 'string' || content.trim().length < 1)) {
        throw new ValidationError('Content must be at least 1 character');
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

      // 7. Update reply via repository
      const updateResult = await replyRepo.update(replyId as ReplyId, {
        content: sanitizedContent,
      });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        throw new ValidationError(
          err.type === 'database' ? err.message : `Repository error: ${err.type}`
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          reply: updateResult.value,
        },
      });
    } catch (error) {
      logger.error('Error updating reply:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);

/**
 * DELETE /api/forums/replies/[id]
 *
 * Deletes a reply (and all its children)
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
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      // 2. Fetch existing reply
      const replyRepo = new ReplyRepository();

      const replyResult = await replyRepo.findById(replyId as ReplyId);

      if (replyResult.isErr()) {
        const err = replyResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      if (!replyResult.value) {
        throw new NotFoundError('Reply', replyId);
      }

      // 3. Check authorization (owner or moderator)
      const reply = replyResult.value;
      if (reply.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError('You do not have permission to delete this reply');
      }

      // 4. Delete via repository
      const deleteResult = await replyRepo.delete(replyId as ReplyId);

      if (deleteResult.isErr()) {
        const err = deleteResult.error;
        throw new Error(err.type === 'database' ? err.message : `Repository error: ${err.type}`);
      }

      // Invalidate stats cache after deleting reply
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json({
        success: true,
        data: {
          message: 'Reply deleted successfully',
        },
      });
    } catch (error) {
      logger.error('Error deleting reply:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);
