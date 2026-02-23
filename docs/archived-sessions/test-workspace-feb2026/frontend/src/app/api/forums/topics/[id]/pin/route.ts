/**
 * Topic Pin API
 *
 * POST /api/forums/topics/[id]/pin - Pin/unpin topic
 *
 * Pins or unpins a topic to keep it at the top of the topic list.
 * Only moderators and admins can pin topics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { forumModerationService } from '@/lib/forums/services';
import { TopicId, UserId } from '@/lib/forums/types';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST - Pin or unpin topic
 */
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      const params = await context.params;
      const topicId = parseInt(params.id, 10);

      if (isNaN(topicId)) {
        throw new ValidationError('Invalid topic ID');
      }

      // Parse request body
      const body = await request.json();
      const { pinned } = body;

      if (typeof pinned !== 'boolean') {
        throw new ValidationError('pinned must be a boolean');
      }

      // Use moderation service (includes permission checks, broadcasting, and logging)
      const result = pinned
        ? await forumModerationService.pinTopic(topicId as TopicId, user.id as UserId)
        : await forumModerationService.unpinTopic(topicId as TopicId, user.id as UserId);

      if (result.isErr()) {
        const err = result.error;
        if (err.type === 'forbidden') {
          throw new ValidationError(err.reason);
        }
        if (err.type === 'not_found') {
          throw new ValidationError(`${err.entity} not found: ${err.id}`);
        }
        throw new ValidationError(err.message || 'Failed to update topic pin status');
      }

      return NextResponse.json({
        success: true,
        data: {
          topic: result.value,
          message: pinned ? 'Topic pinned successfully' : 'Topic unpinned successfully',
        },
      });
    } catch (error) {
      logger.error('Error pinning/unpinning topic:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);
