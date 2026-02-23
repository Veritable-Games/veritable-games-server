'use client';

import React, {
  useState,
  useEffect,
  memo,
  useCallback,
  useMemo,
  useOptimistic,
  startTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { ForumReply, ReplyId, TopicId, UserId } from '@/lib/forums/types';
import { UserLink } from './UserLink';
import Avatar from '@/components/ui/Avatar';
import { UnifiedMarkdownEditor } from '@/components/editor/UnifiedMarkdownEditor';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { ClientDate } from '@/components/ui/ClientDate';
import { VoteButton } from './VoteButton';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

interface ReplyViewProps {
  reply: ForumReply;
  level?: number;
  topicId: number;
  topicAuthorId?: number;
  isTopicLocked?: boolean;
}

const ReplyView = memo<ReplyViewProps>(
  ({ reply, level = 0, topicId, topicAuthorId, isTopicLocked }) => {
    const { user } = useAuth(); // Get user from AuthContext
    const [isEditing, setIsEditing] = useState(false);
    const [replyAuthor, setReplyAuthor] = useState<any>(null);
    const [editContent, setEditContent] = useState(reply.content);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Optimistic UI state for reply content (instant feedback on edit)
    const [optimisticContent, setOptimisticContent] = useOptimistic(
      reply.content,
      (currentContent, newContent: string) => newContent
    );

    // Optimistic UI state for is_solution (syncs with server via router.refresh)
    const [optimisticIsSolution, setOptimisticIsSolution] = useState(reply.is_solution);

    // Sync optimistic content when reply prop changes (from server refresh)
    useEffect(() => {
      // Optimistic updates must happen inside startTransition
      startTransition(() => {
        setOptimisticContent(reply.content);
      });
      setEditContent(reply.content);
    }, [reply.content]);

    // Sync optimistic state when reply prop changes (from server refresh)
    useEffect(() => {
      logger.info(
        `[ReplyView ${reply.id}] useEffect sync: reply.is_solution=${reply.is_solution}, was=${optimisticIsSolution}`
      );
      setOptimisticIsSolution(reply.is_solution);
    }, [reply.is_solution]);

    // Log on mount to debug banner persistence
    useEffect(() => {
      logger.info(
        `[ReplyView ${reply.id}] MOUNT: reply.is_solution=${reply.is_solution}, optimistic=${optimisticIsSolution}`
      );
    }, []);

    // Memoized stable references for performance
    const stableProps = useMemo(
      () => ({
        topicId,
        topicAuthorId,
        isTopicLocked,
      }),
      [topicId, topicAuthorId, isTopicLocked]
    );

    const canEdit = useMemo(
      () => user && (user.id === reply.user_id || user.role === 'admin'),
      [user, reply.user_id]
    );

    // Fetch reply author data on mount
    const fetchReplyAuthor = useCallback(async () => {
      if (reply.user_id) {
        try {
          const response = await fetch(`/api/users/${reply.user_id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setReplyAuthor(data.data);
            }
          }
        } catch (error) {
          logger.debug('Failed to fetch reply author:', error);
        }
      }
    }, [reply.user_id]);

    useEffect(() => {
      fetchReplyAuthor();
    }, [fetchReplyAuthor]);

    // Debug: Log nested reply structure
    useEffect(() => {
      logger.info(`[ReplyView] Reply ${reply.id} at level ${level}:`, {
        hasNestedReplies: !!(reply.children && reply.children.length > 0),
        nestedCount: reply.children?.length || 0,
        parentId: reply.parent_id || 'root',
      });
    }, [reply.id, reply.children, reply.parent_id, level]);

    // Memoized computed values for performance
    const { isAdmin, isTopicAuthor, canMarkSolution, indentLevel } = useMemo(() => {
      const isAdmin = user && user.role === 'admin';
      const isTopicAuthor = user && topicAuthorId && user.id === topicAuthorId;
      const canMarkSolution = isAdmin || isTopicAuthor;
      // Use reply_depth from database or fallback to level prop (allow up to 5 levels of nesting)
      const indentLevel = Math.min(reply.reply_depth ?? level, 5);

      return { isAdmin, isTopicAuthor, canMarkSolution, indentLevel };
    }, [user, topicAuthorId, reply.reply_depth, level]);

    const handleSaveEdit = useCallback(async () => {
      if (!editContent.trim() || loading) return;

      const previousContent = optimisticContent;
      const newContent = editContent.trim();

      // Optimistically update UI immediately
      setOptimisticContent(newContent);
      setIsEditing(false);
      setLoading(true);

      try {
        const response = await fetch(`/api/forums/replies/${reply.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            content: newContent,
          }),
        });

        if (response.ok) {
          // Success - server will sync via router.refresh
          router.refresh();
        } else {
          // Rollback on error
          setOptimisticContent(previousContent);
          setEditContent(previousContent);
          setIsEditing(true);
          const data = await response.json();
          alert(data.error?.message || 'Failed to update reply');
        }
      } catch (error) {
        // Rollback on error
        setOptimisticContent(previousContent);
        setEditContent(previousContent);
        setIsEditing(true);
        logger.error('Reply update error:', error);
        alert('An error occurred while updating your reply');
      } finally {
        setLoading(false);
      }
    }, [editContent, loading, reply.id, router, optimisticContent]);

    const handleCancelEdit = useCallback(() => {
      setEditContent(reply.content);
      setIsEditing(false);
    }, [reply.content]);

    const handleSubmitReply = useCallback(async () => {
      if (!replyContent.trim() || loading || !user) return;

      const trimmedContent = replyContent.trim();

      // Close form and clear content immediately for instant feedback
      setReplyContent('');
      setShowReplyForm(false);
      setLoading(true);

      const payload = {
        topic_id: topicId,
        content: trimmedContent,
        parent_id: reply.id, // Include parent reply ID for nested structure
      };

      logger.info('[ReplySubmit] Creating nested reply:', payload);

      try {
        const response = await fetchWithCSRF('/api/forums/replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          // Success - server will sync via router.refresh
          router.refresh();
        } else {
          // Reopen form with content on error
          const data = await response.json();
          logger.error('Failed to post reply:', data.error);
          setReplyContent(trimmedContent);
          setShowReplyForm(true);
          alert(data.error?.message || 'Failed to post reply');
        }
      } catch (error) {
        logger.error('Nested reply creation error:', error);
        // Reopen form with content on error
        setReplyContent(trimmedContent);
        setShowReplyForm(true);
        alert('An error occurred while posting your reply');
      } finally {
        setLoading(false);
      }
    }, [replyContent, loading, topicId, reply.id, router, user]);

    const handleMarkSolution = useCallback(async () => {
      if (!canMarkSolution || loading) return;

      const confirmMessage = optimisticIsSolution
        ? 'Remove solution mark from this reply?'
        : 'Mark this reply as the solution?';

      if (!confirm(confirmMessage)) {
        return;
      }

      const previousState = optimisticIsSolution;

      // Optimistically update UI immediately
      setOptimisticIsSolution(!optimisticIsSolution);
      setLoading(true);

      try {
        const response = await fetchWithCSRF(`/api/forums/replies/${reply.id}/solution`, {
          method: previousState ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          // Refresh to sync with server (will update reply.is_solution prop)
          router.refresh();
        } else {
          // Rollback optimistic update on error
          setOptimisticIsSolution(previousState);
          const data = await response.json();
          logger.error('Failed to update solution status:', {
            status: response.status,
            statusText: response.statusText,
            data,
            error: data.error,
            message: data.message,
          });
          alert(`Failed to update solution: ${data.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        // Rollback optimistic update on error
        setOptimisticIsSolution(previousState);
        logger.error('Solution status update error:', error);
        alert('An error occurred while updating the solution status');
      } finally {
        setLoading(false);
      }
    }, [canMarkSolution, loading, optimisticIsSolution, reply.id, router]);

    const handleAdminAction = useCallback(
      async (action: string) => {
        // Allow both regular users and admins to delete
        if (action === 'delete' && !canEdit && !isAdmin) return;
        if (action !== 'delete' && !isAdmin) return;

        try {
          // Build URL and method based on action
          let url = `/api/forums/replies/${reply.id}`;
          let method = 'DELETE';

          if (action === 'delete') {
            // If reply is already soft-deleted, this is a hard delete
            if (reply.is_deleted) {
              url += '?permanent=true';
              if (!confirm('Permanently delete this reply? This cannot be undone.')) {
                return;
              }
            } else {
              // First delete is soft delete - add confirmation to prevent accidents
              if (!confirm('Delete this reply? You can permanently remove it later if needed.')) {
                return;
              }
            }
          }

          const response = await fetchWithCSRF(url, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            router.refresh();
          } else {
            const data = await response.json();
            alert(data.error?.message || `Failed to ${action} reply`);
          }
        } catch (error) {
          logger.error(`Admin action ${action} error:`, error);
          alert(`An error occurred while trying to ${action} the reply`);
        }
      },
      [canEdit, isAdmin, reply.is_deleted, reply.id, router]
    );

    // Use static classes for indentation to avoid dynamic class issues
    const indentClasses = [
      '', // level 0
      'ml-6 border-l-2 border-gray-700 pl-4', // level 1
      'ml-12 border-l-2 border-gray-700 pl-4', // level 2
      'ml-16 border-l-2 border-gray-700 pl-4', // level 3
      'ml-20 border-l-2 border-gray-600 pl-4', // level 4
      'ml-24 border-l-2 border-gray-500 pl-4', // level 5
    ];

    return (
      <>
        <div className={indentLevel > 0 ? indentClasses[indentLevel] : ''}>
          {/* Flex container for vote buttons + reply card */}
          <div className="mb-2 flex gap-3">
            {/* Left sidebar: Vote buttons */}
            <VoteButton
              replyId={reply.id}
              initialVoteCount={reply.vote_count || 0}
              initialUserVote={reply.user_vote || null}
              authorId={reply.user_id}
              className="pt-2"
            />

            {/* Right side: Reply card */}
            <div className="flex-1 overflow-hidden rounded border border-gray-700 bg-gray-900/30">
              {/* Solution Badge - Only show if marked as solution */}
              {!!optimisticIsSolution && (
                <div className="flex items-center gap-2 border-b border-emerald-700/50 bg-emerald-900/20 px-4 py-2">
                  <svg
                    className="h-4 w-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Accepted Solution
                  </span>
                </div>
              )}

              {/* Reply Header - Tighter spacing */}
              <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Author Avatar */}
                    <Avatar
                      user={
                        replyAuthor || {
                          id: reply.user_id,
                          username: reply.username || 'Unknown',
                          display_name: reply.username || 'Unknown',
                        }
                      }
                      size="md"
                    />

                    <div>
                      <div className="flex items-center space-x-2">
                        <UserLink
                          userId={reply.user_id}
                          username={reply.username || 'Unknown User'}
                          className="text-sm font-medium text-white"
                        />
                        {/* Show "replying to" indicator - removed (was part of conversation detection) */}
                      </div>
                      <div className="text-xs text-gray-400">
                        <ClientDate date={reply.created_at} format="full" />
                        {reply.created_at !== reply.updated_at && (
                          <span className="ml-2 text-gray-500">(edited)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Edit button in top right */}
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-gray-400 transition-colors hover:text-blue-400"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Reply Content - Tighter spacing */}
              <div className="p-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <UnifiedMarkdownEditor
                      content={editContent}
                      onChange={setEditContent}
                      placeholder="Edit your reply..."
                      minRows={8}
                      features="simple"
                    />

                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim() || loading}
                        className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : reply.is_deleted ? (
                  <div className="py-4 text-sm italic text-gray-500">[Reply Removed]</div>
                ) : (
                  <HybridMarkdownRenderer
                    content={optimisticContent}
                    className="text-sm leading-relaxed text-gray-200"
                  />
                )}
              </div>

              {/* Reply Actions Footer */}
              <div className="border-t border-gray-700 bg-gray-800/30 px-4 py-2">
                <div className="flex items-center justify-between">
                  {/* Left side: Reply button or login message */}
                  <div className="flex items-center">
                    {!user && !reply.is_deleted && (
                      <span className="text-sm text-gray-500">Login to reply</span>
                    )}

                    {!!(user && !isTopicLocked && !reply.is_deleted) && (
                      <button
                        onClick={() => setShowReplyForm(!showReplyForm)}
                        className="rounded border border-blue-500/50 bg-gray-800/40 px-4 py-2 text-sm font-medium text-blue-400 transition-all hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
                      >
                        Reply
                      </button>
                    )}
                  </div>

                  {/* Right side: Mark Solution and Delete */}
                  <div className="flex items-center space-x-2">
                    {/* Mark as Solution - Gray text */}
                    {!!(canMarkSolution && !reply.is_deleted) && (
                      <>
                        <button
                          onClick={handleMarkSolution}
                          disabled={loading}
                          className={`text-xs font-medium text-gray-500 transition-colors hover:text-gray-400 ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {optimisticIsSolution ? 'Unmark as Solution' : 'Mark as Solution'}
                        </button>
                        {(canEdit || isAdmin) && <span className="text-gray-600">|</span>}
                      </>
                    )}

                    {/* Delete - Shows different text based on deletion state */}
                    {(canEdit || isAdmin) && (
                      <button
                        onClick={() => handleAdminAction('delete')}
                        className={
                          reply.is_deleted
                            ? 'text-xs text-red-500 transition-colors hover:text-red-400'
                            : 'text-xs text-gray-500 transition-colors hover:text-red-400'
                        }
                        title={
                          reply.is_deleted
                            ? 'Click again to permanently remove'
                            : 'Soft delete this reply'
                        }
                      >
                        {reply.is_deleted ? 'Permanently Delete' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Reply Form */}
              {!!(showReplyForm && user && !isTopicLocked) && (
                <div className="border-t border-gray-700 bg-gray-800/30 p-4">
                  <div className="space-y-3">
                    <UnifiedMarkdownEditor
                      content={replyContent}
                      onChange={setReplyContent}
                      placeholder="Write your reply..."
                      minRows={6}
                      features="simple"
                    />

                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setShowReplyForm(false)}
                        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitReply}
                        disabled={!replyContent.trim() || loading}
                        className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Posting...' : 'Post Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nested Replies */}
          {reply.children && reply.children.length > 0 && (
            <div className="space-y-0" role="tree" aria-label="Nested replies">
              {reply.children.map(nestedReply => (
                <ReplyView
                  key={nestedReply.id}
                  reply={nestedReply}
                  level={level + 1} // Increment level for proper nesting
                  topicId={topicId}
                  topicAuthorId={topicAuthorId}
                  isTopicLocked={isTopicLocked}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo optimization per React expert recommendations
    return (
      prevProps.reply.id === nextProps.reply.id &&
      prevProps.reply.updated_at === nextProps.reply.updated_at &&
      prevProps.reply.is_deleted === nextProps.reply.is_deleted &&
      prevProps.reply.is_solution === nextProps.reply.is_solution &&
      prevProps.level === nextProps.level &&
      prevProps.isTopicLocked === nextProps.isTopicLocked &&
      prevProps.topicAuthorId === nextProps.topicAuthorId
    );
  }
);

ReplyView.displayName = 'ReplyView';

interface ReplyListProps {
  replies: ForumReply[];
  topicId: number;
  topicTitle: string;
  topicAuthorId?: number;
  isTopicLocked?: boolean;
}

export const ReplyList: React.FC<ReplyListProps> = ({
  replies,
  topicId,
  topicTitle,
  topicAuthorId,
  isTopicLocked,
}) => {
  const { user } = useAuth();
  const [newReplyContent, setNewReplyContent] = useState('');
  const router = useRouter();

  // Optimistic UI state for replies list (instant feedback on new reply)
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    replies,
    (currentReplies, newReply: ForumReply) => [...currentReplies, newReply]
  );

  // Optimized callback for scrolling to reply editor
  const scrollToReplyEditor = useCallback(() => {
    const editor = document.getElementById('reply-editor');
    if (editor) {
      // Smooth scroll to editor with offset for header
      editor.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      // Focus textarea after scroll completes
      setTimeout(() => {
        const textarea = editor.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }, 500);
    }
  }, []);

  const handleSubmitNewReply = useCallback(async () => {
    if (!newReplyContent.trim() || !user) return;

    const trimmedContent = newReplyContent.trim();

    // Create optimistic reply (temporary ID will be replaced by server)
    const optimisticReply: ForumReply = {
      id: Date.now() as ReplyId, // Temporary ID (will be replaced by server)
      topic_id: topicId as TopicId,
      user_id: user.id as UserId,
      username: user.username,
      content: trimmedContent,
      parent_id: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      is_solution: false,
      replies: [],
    };

    // Optimistically add reply to UI immediately
    addOptimisticReply(optimisticReply);
    setNewReplyContent('');

    try {
      const response = await fetchWithCSRF('/api/forums/replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topicId,
          content: trimmedContent,
        }),
      });

      if (response.ok) {
        // Success - server will sync via router.refresh
        router.refresh();
      } else {
        // On error, refresh will revert to server state (removes optimistic reply)
        const data = await response.json();
        alert(data.error?.message || 'Failed to post reply');
        router.refresh();
      }
    } catch (error) {
      logger.error('Reply creation error:', error);
      alert('An error occurred while posting your reply');
      // Refresh to revert optimistic update
      router.refresh();
    }
  }, [newReplyContent, topicId, router, user, addOptimisticReply]);

  if (replies.length === 0) {
    return (
      <div className="space-y-6">
        {/* Only show "No Replies" message if user is NOT logged in or topic is locked */}
        {(!user || !!isTopicLocked) && (
          <div className="rounded border border-gray-700 bg-gray-900/50 p-8 text-center">
            <div className="mb-4 text-gray-300">No replies yet</div>
            <p className="text-sm text-gray-400">Be the first to join the conversation!</p>

            {!!isTopicLocked && <div className="mt-4 text-sm text-gray-500">Topic is locked</div>}
            {!user && !isTopicLocked && (
              <div className="mt-4 text-sm text-gray-500">Login to post the first reply</div>
            )}
          </div>
        )}

        {/* New Reply Form - Show by default when logged in */}
        {user && !isTopicLocked && (
          <div id="reply-editor">
            <h3 className="mb-4 text-lg font-medium text-white">Reply to "{topicTitle}"</h3>

            <UnifiedMarkdownEditor
              content={newReplyContent}
              onChange={setNewReplyContent}
              placeholder="Be the first to reply..."
              minRows={8}
              features="simple"
            />

            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSubmitNewReply}
                disabled={!newReplyContent.trim()}
                className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
              >
                Post Reply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Replies */}
      <div className="space-y-0">
        {optimisticReplies.map(reply => (
          <ReplyView
            key={reply.id}
            reply={reply}
            level={0} // Top-level replies start at level 0
            topicId={topicId}
            topicAuthorId={topicAuthorId}
            isTopicLocked={isTopicLocked}
          />
        ))}
      </div>

      {/* New Reply Form - Always visible when logged in and topic not locked */}
      {user && !isTopicLocked ? (
        <div id="reply-editor">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Reply to "{topicTitle}"</h3>
          </div>

          <UnifiedMarkdownEditor
            content={newReplyContent}
            onChange={setNewReplyContent}
            placeholder="Write your reply..."
            minRows={8}
            features="simple"
          />

          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSubmitNewReply}
              disabled={!newReplyContent.trim()}
              className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              Post Reply
            </button>
          </div>
        </div>
      ) : isTopicLocked ? (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-6 text-center">
          <div className="text-gray-500">Topic is locked</div>
          <div className="mt-2 text-sm text-gray-500">No new replies can be posted</div>
        </div>
      ) : (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-6 text-center">
          <div className="mb-2 text-gray-400">Want to join the conversation?</div>
          <div className="text-sm text-gray-500">Login to post a reply</div>
        </div>
      )}
    </div>
  );
};

ReplyList.displayName = 'ReplyList';
