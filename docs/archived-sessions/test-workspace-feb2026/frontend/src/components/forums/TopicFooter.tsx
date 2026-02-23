'use client';

import React from 'react';

interface TopicFooterProps {
  user: any;
  topic: {
    id: number;
    user_id: number;
    is_locked: boolean;
  };
  isAdmin: boolean;
  onScrollToReplyEditor: () => void;
  onDelete: () => void;
}

/**
 * TopicFooter Component
 *
 * Displays the footer with reply button and action links.
 * Extracted from TopicView.tsx for better organization.
 */
export function TopicFooter({
  user,
  topic,
  isAdmin,
  onScrollToReplyEditor,
  onDelete,
}: TopicFooterProps) {
  return (
    <div className="border-t border-gray-700 bg-gray-800/30 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!user && <span className="text-sm text-gray-500">Login to reply</span>}

          {/* Reply to Topic button */}
          {user && !topic.is_locked && (
            <button
              onClick={onScrollToReplyEditor}
              className="rounded border border-blue-500/50 bg-gray-800/40 px-4 py-2 text-sm font-medium text-blue-400 transition-all hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
            >
              Reply to Topic
            </button>
          )}
        </div>

        {/* Right side: Plain text action buttons */}
        <div className="flex items-center space-x-2">
          {/* Delete button - for admins and topic authors */}
          {(isAdmin || (user && user.id === topic.user_id)) && (
            <button
              onClick={onDelete}
              className="text-xs text-gray-500 transition-colors hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
