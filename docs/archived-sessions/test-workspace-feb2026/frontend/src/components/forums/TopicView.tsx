'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TopicWithReplies } from '@/lib/forums/types';
import { ForumTag } from '@/lib/forums/tags';
import { TagDisplay } from './TagDisplay';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { ClientDate } from '@/components/ui/ClientDate';
import { useAuth } from '@/contexts/AuthContext';
import { TopicEditForm } from './TopicEditForm';
import { TopicFooter } from './TopicFooter';
import { OptimisticTopicWrapper } from './OptimisticTopicWrapper';
import { OptimisticStatusBadges } from './OptimisticStatusBadges';
import { OptimisticModerationDropdown } from './OptimisticModerationDropdown';
import Avatar from '@/components/ui/Avatar';
import { UserLink } from './UserLink';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAlertDialog } from '@/hooks/useAlertDialog';

interface TopicViewProps {
  topic: TopicWithReplies;
  tags?: ForumTag[];
}

/**
 * TopicView Component
 *
 * Main component for displaying a forum topic.
 * Refactored from 683 lines to 250 lines by extracting sub-components:
 * - TopicHeader: Author info, status badges, moderation controls
 * - TopicStatusBadges: Visual status indicators
 * - TopicModerationDropdown: Admin moderation menu
 * - TopicEditForm: Inline edit form
 * - TopicFooter: Reply button and actions
 */
export function TopicView({ topic: initialTopic, tags = [] }: TopicViewProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [topicAuthor, setTopicAuthor] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(initialTopic.content);
  const [editTitle, setEditTitle] = useState(initialTopic.title);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Dialog hooks
  const { showConfirm, ConfirmDialog } = useConfirmDialog();
  const { showAlert, AlertDialog } = useAlertDialog();

  // Note: Removed local topic state to prevent stale data
  // OptimisticTopicWrapper manages all topic state including status flags
  // We use initialTopic (from SSR) directly and let the wrapper handle updates

  // Fetch topic author on mount
  useEffect(() => {
    fetchTopicAuthor();
  }, []);

  const fetchTopicAuthor = async () => {
    if (initialTopic.user_id) {
      try {
        const response = await fetch(`/api/users/${initialTopic.user_id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTopicAuthor(data.data);
          }
        }
      } catch (error) {
        logger.debug('Failed to fetch topic author:', error);
      }
    }
  };

  const canEdit = Boolean(user && (user.id === initialTopic.user_id || user.role === 'admin'));
  const isAdmin = Boolean(user && user.role === 'admin');

  const scrollToReplyEditor = () => {
    const editor = document.getElementById('reply-editor');
    if (editor) {
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const textarea = editor.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 500);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      setEditError('Title and content are required.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/forums/topics/${initialTopic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save topic');
      }

      if (data.success) {
        setIsEditing(false);
        setEditError(null);

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Topic updated successfully';
        successMsg.className =
          'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
        document.body.appendChild(successMsg);

        // Refresh page to update server-rendered title
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to save topic');
      }
    } catch (error) {
      logger.error('Topic edit error:', error);
      setEditError(
        error instanceof Error ? error.message : 'Failed to save topic. Please try again.'
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(initialTopic.content);
    setEditTitle(initialTopic.title);
    setEditError(null);
    setIsEditing(false);
  };

  // Delete is handled separately (not part of optimistic UI)
  const handleDeleteTopic = async () => {
    if (!isAdmin) {
      logger.error('Not admin, cannot perform action');
      return;
    }

    const confirmed = await showConfirm('Delete this topic?', 'This action cannot be undone.', {
      confirmLabel: 'Delete',
      type: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithCSRF(`/api/forums/topics/${initialTopic.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        showAlert('Topic deleted successfully', 'success');
        setTimeout(() => {
          window.location.href = '/forums';
        }, 1500);
      } else {
        const errorMessage = data?.error?.message || data?.message || 'Failed to delete topic';
        showAlert(errorMessage, 'error');
      }
    } catch (error) {
      logger.error('Delete topic error:', error);
      showAlert('An error occurred while trying to delete the topic', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <OptimisticTopicWrapper
        initialTopic={{
          id: initialTopic.id,
          category_id: initialTopic.category_id,
          status: initialTopic.status,
          is_locked: Boolean(initialTopic.is_locked),
          is_pinned: Boolean(initialTopic.is_pinned),
          is_solved: Boolean(initialTopic.is_solved),
          is_archived: Boolean(initialTopic.is_archived),
        }}
        onError={error => {
          logger.error('Moderation error:', error);
          alert(`Error: ${error.message}`);
        }}
      >
        {({ topic: optimisticTopic, actions, isPending }) => (
          <div className="space-y-4">
            {/* Error Display - At top of page */}
            {editError && (
              <div className="rounded-md border border-red-600/50 bg-red-900/30 p-3">
                <div className="flex items-center space-x-2">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-400">{editError}</p>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/30">
              {/* Topic Header with Optimistic Components */}
              <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Author Avatar */}
                    <Avatar
                      user={
                        topicAuthor || {
                          id: initialTopic.user_id,
                          username: initialTopic.username || 'Unknown',
                          display_name: initialTopic.username || 'Unknown',
                        }
                      }
                      size="lg"
                    />

                    <div>
                      <div className="text-sm font-medium text-white">
                        <UserLink
                          userId={initialTopic.user_id}
                          username={initialTopic.username || 'Unknown User'}
                          className="text-sm font-medium text-white"
                        />
                      </div>
                      <div className="text-xs text-gray-400">
                        <ClientDate date={initialTopic.created_at} format="full" />
                        {initialTopic.created_at !== initialTopic.updated_at && (
                          <span className="ml-2 text-gray-500">(edited)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Optimistic Status and Moderation */}
                  <div className="flex items-center space-x-3">
                    <OptimisticStatusBadges
                      topic={optimisticTopic}
                      isPending={isPending}
                      size="sm"
                    />

                    {canEdit && !isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-blue-400"
                      >
                        Edit
                      </button>
                    )}

                    {/* Optimistic Moderation Controls - Admin only */}
                    {isAdmin && (
                      <OptimisticModerationDropdown
                        topic={optimisticTopic}
                        actions={actions}
                        isPending={isPending}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Topic Content */}
              <div className="p-3">
                {isEditing ? (
                  <TopicEditForm
                    title={editTitle}
                    content={editContent}
                    error={null}
                    loading={editLoading}
                    onTitleChange={setEditTitle}
                    onContentChange={setEditContent}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <HybridMarkdownRenderer
                    content={initialTopic.content}
                    className="leading-relaxed text-gray-200"
                  />
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <TagDisplay
                      tags={tags}
                      size="sm"
                      showUsageCount={false}
                      linkable={true}
                      className="flex-wrap"
                    />
                  </div>
                )}
              </div>

              {/* Topic Footer */}
              <TopicFooter
                user={user}
                topic={{
                  id: initialTopic.id,
                  user_id: initialTopic.user_id,
                  is_locked: Boolean(optimisticTopic.is_locked),
                }}
                isAdmin={isAdmin}
                onScrollToReplyEditor={scrollToReplyEditor}
                onDelete={handleDeleteTopic}
              />
            </div>
          </div>
        )}
      </OptimisticTopicWrapper>
      {ConfirmDialog}
      {AlertDialog}
    </>
  );
}
