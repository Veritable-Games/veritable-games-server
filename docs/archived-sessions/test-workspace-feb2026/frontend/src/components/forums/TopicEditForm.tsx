'use client';

import React from 'react';
import { HybridMarkdownEditor } from '@/components/editor/HybridMarkdownEditor';

interface TopicEditFormProps {
  title: string;
  content: string;
  error: string | null;
  loading: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * TopicEditForm Component
 *
 * Inline edit form for topic title and content.
 * Extracted from TopicView.tsx to separate edit concerns.
 */
export function TopicEditForm({
  title,
  content,
  error,
  loading,
  onTitleChange,
  onContentChange,
  onSave,
  onCancel,
}: TopicEditFormProps) {
  return (
    <div className="space-y-4">
      {/* Title Edit Field */}
      <div>
        <label htmlFor="edit-title" className="mb-2 block text-sm font-medium text-gray-300">
          Topic Title
        </label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Enter topic title..."
          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content Edit Field */}
      <div>
        <label htmlFor="edit-content" className="mb-2 block text-sm font-medium text-gray-300">
          Topic Content
        </label>
        <HybridMarkdownEditor
          content={content}
          onChange={onContentChange}
          placeholder="Write your topic content..."
          rows={12}
        />
      </div>

      {/* Error now displayed at top of page, not here */}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={loading}
          className="flex items-center space-x-2 rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          <span>{loading ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
