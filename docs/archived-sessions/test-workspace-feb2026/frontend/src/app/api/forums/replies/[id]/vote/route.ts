/**
 * Reply Voting API
 *
 * POST /api/forums/replies/[id]/vote - Cast or change vote on a reply
 *
 * Allows users to upvote or downvote forum replies.
 * Users cannot vote on their own replies.
 * Submitting the same vote type removes the vote (toggle behavior).
 *
 * Request body:
 * {
 *   vote: 'up' | 'down' | null  // null removes the vote
 * }
 *
 * Response:
 * {
 *   success: true,
 *   vote_count: number,
 *   user_vote: 'up' | 'down' | null
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import {
  errorResponse,
  AuthenticationError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

type VoteType = 'up' | 'down' | null;

/**
 * POST - Cast or change vote on a reply
 */
export const POST = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      // 1. Authenticate user
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // 2. Parse and validate reply ID
      const params = await context.params;
      const replyId = parseInt(params.id, 10);

      if (isNaN(replyId)) {
        throw new ValidationError('Invalid reply ID');
      }

      // 3. Parse and validate vote type
      const body = await request.json();
      const vote: VoteType = body.vote;

      if (vote !== null && vote !== 'up' && vote !== 'down') {
        throw new ValidationError('Vote must be "up", "down", or null');
      }

      // 4. Verify reply exists and get author
      const replyResult = await dbAdapter.query(
        'SELECT id, user_id FROM forum_replies WHERE id = ? AND deleted_at IS NULL',
        [replyId],
        { schema: 'forums' }
      );

      if (replyResult.rows.length === 0) {
        throw new NotFoundError('Reply', replyId);
      }

      const reply = replyResult.rows[0];
      const authorId = reply.user_id;

      // 5. Prevent self-voting
      if (authorId === user.id) {
        throw new PermissionError('You cannot vote on your own replies');
      }

      // 6. Get current vote (if any)
      const existingVoteResult = await dbAdapter.query(
        'SELECT vote_type FROM forum_votes WHERE user_id = ? AND reply_id = ?',
        [user.id, replyId],
        { schema: 'forums' }
      );

      const existingVote: VoteType =
        existingVoteResult.rows.length > 0 ? existingVoteResult.rows[0].vote_type : null;

      // 7. Handle vote logic
      if (vote === null) {
        // Remove vote
        if (existingVote !== null) {
          await dbAdapter.query(
            'DELETE FROM forum_votes WHERE user_id = ? AND reply_id = ?',
            [user.id, replyId],
            { schema: 'forums' }
          );
          logger.info('Vote removed', {
            userId: user.id,
            replyId,
            previousVote: existingVote,
          });
        }
      } else if (existingVote === null) {
        // New vote
        await dbAdapter.query(
          'INSERT INTO forum_votes (user_id, reply_id, vote_type) VALUES (?, ?, ?)',
          [user.id, replyId, vote],
          { schema: 'forums' }
        );
        logger.info('Vote cast', { userId: user.id, replyId, vote });
      } else if (existingVote === vote) {
        // Clicking same vote removes it
        await dbAdapter.query(
          'DELETE FROM forum_votes WHERE user_id = ? AND reply_id = ?',
          [user.id, replyId],
          { schema: 'forums' }
        );
        logger.info('Vote toggled off', {
          userId: user.id,
          replyId,
          previousVote: existingVote,
        });
      } else {
        // Change vote
        await dbAdapter.query(
          'UPDATE forum_votes SET vote_type = ?, updated_at = NOW() WHERE user_id = ? AND reply_id = ?',
          [vote, user.id, replyId],
          { schema: 'forums' }
        );
        logger.info('Vote changed', {
          userId: user.id,
          replyId,
          from: existingVote,
          to: vote,
        });
      }

      // 8. Get updated vote count
      // (The trigger should have already updated forum_replies.vote_count)
      const voteCountResult = await dbAdapter.query(
        'SELECT COALESCE(vote_count, 0) as vote_count FROM forum_replies WHERE id = ?',
        [replyId],
        { schema: 'forums' }
      );

      const voteCount = voteCountResult.rows[0]?.vote_count || 0;

      // 9. Get user's current vote
      const newVoteResult = await dbAdapter.query(
        'SELECT vote_type FROM forum_votes WHERE user_id = ? AND reply_id = ?',
        [user.id, replyId],
        { schema: 'forums' }
      );

      const userVote: VoteType =
        newVoteResult.rows.length > 0 ? newVoteResult.rows[0].vote_type : null;

      return NextResponse.json({
        success: true,
        vote_count: voteCount,
        user_vote: userVote,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
);
