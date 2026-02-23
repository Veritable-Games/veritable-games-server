/**
 * Reply Solution API
 *
 * POST /api/forums/replies/[id]/solution - Mark reply as solution
 * DELETE /api/forums/replies/[id]/solution - Unmark reply as solution
 *
 * Marks this reply as the accepted solution for its topic.
 * Only the topic author or moderators can mark a solution.
 * This automatically updates the topic status to 'solved'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { ReplyRepository } from '@/lib/forums/repositories/reply-repository';
import { TopicRepository } from '@/lib/forums/repositories/topic-repository';
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
import { TopicStatusFlags, removeFlag } from '@/lib/forums/status-flags';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST - Mark reply as solution
 */
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      const params = await context.params;
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      // 1. Fetch reply to get topic info
      const replyRepo = new ReplyRepository();
      const replyResult = await replyRepo.findById(replyId as ReplyId);

      if (replyResult.isErr()) {
        const err = replyResult.error;
        if (err.type === 'not_found') {
          throw new NotFoundError('Reply', replyId);
        }
        throw new ValidationError(err.message || 'Failed to fetch reply');
      }

      if (!replyResult.value) {
        throw new NotFoundError('Reply', replyId);
      }

      const reply = replyResult.value;

      // 2. Fetch topic to verify permissions
      const topicRepo = new TopicRepository();
      const topicResult = await topicRepo.findById(reply.topic_id);

      if (topicResult.isErr()) {
        const err = topicResult.error;
        if (err.type === 'not_found') {
          throw new NotFoundError('Topic', reply.topic_id);
        }
        throw new ValidationError(err.message || 'Failed to fetch topic');
      }

      if (!topicResult.value) {
        throw new NotFoundError('Topic', reply.topic_id);
      }

      const topic = topicResult.value;

      // 3. Only topic author or moderators can mark solution
      if (topic.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError(
          'Only the topic author or moderators can mark a reply as the solution'
        );
      }

      // 4. Mark reply as solution (also updates topic status)
      const markResult = await replyRepo.markAsSolution(replyId as ReplyId);

      if (markResult.isErr()) {
        const err = markResult.error;
        throw new ValidationError(
          err.type === 'validation' ? err.message : 'Failed to mark reply as solution'
        );
      }

      // Invalidate caches after marking solution
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json({
        success: true,
        data: {
          reply: markResult.value,
          message: 'Reply marked as solution',
        },
      });
    } catch (error) {
      logger.error('Error marking reply as solution:', error);
      return errorResponse(error);
    }
  },
  {} // CSRF disabled - removed in October 2025
);

/**
 * DELETE - Unmark reply as solution
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      const params = await context.params;
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      // 1. Fetch reply to get topic info
      const replyRepo = new ReplyRepository();
      const replyResult = await replyRepo.findById(replyId as ReplyId);

      if (replyResult.isErr()) {
        const err = replyResult.error;
        if (err.type === 'not_found') {
          throw new NotFoundError('Reply', replyId);
        }
        throw new ValidationError(err.message || 'Failed to fetch reply');
      }

      if (!replyResult.value) {
        throw new NotFoundError('Reply', replyId);
      }

      const reply = replyResult.value;

      // 2. Fetch topic to verify permissions
      const topicRepo = new TopicRepository();
      const topicResult = await topicRepo.findById(reply.topic_id);

      if (topicResult.isErr()) {
        const err = topicResult.error;
        if (err.type === 'not_found') {
          throw new NotFoundError('Topic', reply.topic_id);
        }
        throw new ValidationError(err.message || 'Failed to fetch topic');
      }

      if (!topicResult.value) {
        throw new NotFoundError('Topic', reply.topic_id);
      }

      const topic = topicResult.value;

      // 3. Only topic author or moderators can unmark solution
      if (topic.user_id !== user.id && user.role !== 'moderator' && user.role !== 'admin') {
        throw new PermissionError('Only the topic author or moderators can unmark a solution');
      }

      // 4. Unmark reply as solution and update topic status back to 'open'
      const updateResult = await replyRepo.update(replyId as ReplyId, { is_solution: false });

      if (updateResult.isErr()) {
        const err = updateResult.error;
        throw new ValidationError(
          err.type === 'validation' ? err.message : 'Failed to unmark reply as solution'
        );
      }

      // Update topic status by removing SOLVED flag
      const newStatus = removeFlag(topic.status, TopicStatusFlags.SOLVED);
      await topicRepo.update(reply.topic_id, { status: newStatus });

      // Invalidate caches after unmarking solution
      ForumServiceUtils.invalidateCaches();

      return NextResponse.json({
        success: true,
        data: {
          reply: updateResult.value,
          message: 'Solution mark removed',
        },
      });
    } catch (error) {
      logger.error('Error unmarking reply as solution:', error);
      return errorResponse(error);
    }
  },
  {} // CSRF disabled - removed in October 2025
);
