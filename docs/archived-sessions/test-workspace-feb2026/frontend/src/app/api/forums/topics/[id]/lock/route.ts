/**
 * Topic Lock API
 *
 * POST /api/forums/topics/[id]/lock - Lock/unlock topic
 *
 * Locks or unlocks a topic to prevent new replies.
 * Only moderators and admins can lock topics.
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
 * POST - Lock or unlock topic
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
      const { locked } = body;

      if (typeof locked !== 'boolean') {
        throw new ValidationError('locked must be a boolean');
      }

      // Use moderation service (includes permission checks, broadcasting, and logging)
      const result = locked
        ? await forumModerationService.lockTopic(topicId as TopicId, user.id as UserId)
        : await forumModerationService.unlockTopic(topicId as TopicId, user.id as UserId);

      if (result.isErr()) {
        const err = result.error;
        if (err.type === 'forbidden') {
          throw new ValidationError(err.reason);
        }
        if (err.type === 'not_found') {
          throw new ValidationError(`${err.entity} not found: ${err.id}`);
        }
        throw new ValidationError(err.message || 'Failed to update topic lock status');
      }

      return NextResponse.json({
        success: true,
        data: {
          topic: result.value,
          message: locked ? 'Topic locked successfully' : 'Topic unlocked successfully',
        },
      });
    } catch (error) {
      logger.error('Error locking/unlocking topic:', error);
      return errorResponse(error);
    }
  },
  { enableCSRF: false } // CSRF disabled - removed in October 2025
);
