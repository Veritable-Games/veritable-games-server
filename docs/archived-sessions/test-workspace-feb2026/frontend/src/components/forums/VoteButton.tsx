/**
 * VoteButton Component
 *
 * Left sidebar voting buttons (Reddit/Stack Overflow style) for forum replies.
 * Displays upvote/downvote arrows with vote count.
 *
 * Features:
 * - Visual feedback for user's vote state (upvoted/downvoted/none)
 * - Optimistic UI updates
 * - Hover tooltips
 * - Prevents self-voting
 * - Integrates with reputation system
 *
 * Usage:
 * ```tsx
 * <VoteButton
 *   replyId={reply.id}
 *   initialVoteCount={reply.vote_count}
 *   initialUserVote={reply.user_vote}
 *   authorId={reply.user_id}
 * />
 * ```
 *
 * @module components/forums/VoteButton
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAlertDialog } from '@/hooks/useAlertDialog';

export type VoteType = 'up' | 'down' | null;

interface VoteButtonProps {
  /** Reply ID to vote on */
  replyId: number;
  /** Initial vote count */
  initialVoteCount: number;
  /** User's current vote (if any) */
  initialUserVote?: VoteType;
  /** Reply author's user ID (to prevent self-voting) */
  authorId: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * Vote Button Component
 *
 * Left sidebar with up/down arrows and vote count
 */
export function VoteButton({
  replyId,
  initialVoteCount,
  initialUserVote = null,
  authorId,
  className = '',
}: VoteButtonProps) {
  const { user } = useAuth();
  const { showAlert, AlertDialog } = useAlertDialog();
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [userVote, setUserVote] = useState<VoteType>(initialUserVote);
  const [isVoting, setIsVoting] = useState(false);

  // Prevent self-voting
  const isSelfVote = user?.id === authorId;

  const handleVote = async (type: VoteType) => {
    if (!user) {
      showAlert('Please log in to vote', 'info');
      return;
    }

    if (isSelfVote) {
      showAlert('You cannot vote on your own replies', 'warning');
      return;
    }

    if (isVoting) return;

    // Optimistic update
    const previousVote = userVote;
    const previousCount = voteCount;

    let newCount = voteCount;
    let newVote: VoteType = type;

    // Calculate new vote count
    if (previousVote === type) {
      // Clicking same vote removes it
      newVote = null;
      newCount = type === 'up' ? voteCount - 1 : voteCount + 1;
    } else if (previousVote === null) {
      // No previous vote
      newCount = type === 'up' ? voteCount + 1 : voteCount - 1;
    } else {
      // Switching vote (up to down or down to up)
      newCount = type === 'up' ? voteCount + 2 : voteCount - 2;
    }

    // Optimistic UI update
    setUserVote(newVote);
    setVoteCount(newCount);
    setIsVoting(true);

    try {
      // TODO: Implement API call
      const response = await fetch(`/api/forums/replies/${replyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vote: newVote }),
      });

      if (!response.ok) {
        // Rollback on error
        setUserVote(previousVote);
        setVoteCount(previousCount);
        showAlert('Failed to register vote. Please try again.', 'error');
      }
    } catch (error) {
      // Rollback on error
      setUserVote(previousVote);
      setVoteCount(previousCount);
      showAlert('An error occurred while voting', 'error');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {/* Upvote Button */}
      <button
        type="button"
        onClick={() => handleVote('up')}
        disabled={isVoting || isSelfVote}
        className={`group rounded p-1 transition-colors ${
          userVote === 'up'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'text-gray-500 hover:bg-gray-700 hover:text-emerald-400'
        } ${isSelfVote ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${isVoting ? 'opacity-50' : ''}`}
        title={isSelfVote ? 'Cannot vote on own reply' : 'Upvote'}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={userVote === 'up' ? 2.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Vote Count */}
      <div
        className={`text-sm font-semibold ${
          userVote === 'up'
            ? 'text-emerald-400'
            : userVote === 'down'
              ? 'text-red-400'
              : 'text-gray-400'
        }`}
      >
        {voteCount}
      </div>

      {/* Downvote Button */}
      <button
        type="button"
        onClick={() => handleVote('down')}
        disabled={isVoting || isSelfVote}
        className={`group rounded p-1 transition-colors ${
          userVote === 'down'
            ? 'bg-red-500/20 text-red-400'
            : 'text-gray-500 hover:bg-gray-700 hover:text-red-400'
        } ${isSelfVote ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${isVoting ? 'opacity-50' : ''}`}
        title={isSelfVote ? 'Cannot vote on own reply' : 'Downvote'}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={userVote === 'down' ? 2.5 : 2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
