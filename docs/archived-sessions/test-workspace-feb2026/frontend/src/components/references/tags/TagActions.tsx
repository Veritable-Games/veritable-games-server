'use client';

import { useState } from 'react';
import type { ReferenceTag, ReferenceTagId } from '@/types/project-references';
import { fetchJSON } from '@/lib/utils/csrf';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { logger } from '@/lib/utils/logger';

interface TagActionsProps {
  allTags: ReferenceTag[];
  selectedTagIds: ReferenceTagId[];
  onAdd: (tagId: ReferenceTagId) => Promise<void>;
  isLoading?: boolean;
  projectSlug: string;
  onTagsRefresh: () => Promise<void>;
}

export function TagActions({
  allTags,
  selectedTagIds,
  onAdd,
  isLoading,
  projectSlug,
  onTagsRefresh,
}: TagActionsProps) {
  const config = useReferencesStore(state => state.config);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTags = allTags.filter(tag => !selectedTagIds.includes(tag.id));

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !config) return;

    setIsSubmitting(true);
    setCreateError('');

    try {
      const apiPath = config.uploadPath.replace('[slug]', projectSlug);
      const response = await fetchJSON<{ success: boolean; tag_id: string }>(`${apiPath}/tags`, {
        method: 'POST',
        body: { name: newTagName.trim() },
      });

      // Refresh tags list to include new tag
      await onTagsRefresh();

      // Automatically add the newly created tag to the current image
      if (response.tag_id) {
        await onAdd(response.tag_id as unknown as ReferenceTagId);
      }

      setNewTagName('');
      setIsCreating(false);
      setIsOpen(false); // Close dropdown after successful creation
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = async (tagId: ReferenceTagId) => {
    try {
      await onAdd(tagId);
      setIsOpen(false);
    } catch (error) {
      logger.error('Failed to add tag:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={e => {
          e.stopPropagation(); // Prevent lightbox from closing
          setIsOpen(!isOpen);
        }}
        disabled={isLoading}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-gray-600 bg-gray-800/50 px-1.5 py-0.5 text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-800/70 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50"
        aria-label="Add tag"
        aria-expanded={isOpen}
        aria-controls="tag-selector"
        style={{ minHeight: '24px' }}
      >
        {isLoading ? (
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          id="tag-selector"
          role="menu"
          aria-label="Available tags"
          onClick={e => e.stopPropagation()} // Prevent lightbox from closing when clicking inside dropdown
          className="absolute bottom-full left-0 z-50 mb-2 max-h-80 min-w-[250px] max-w-[400px] overflow-y-auto rounded-lg border border-gray-600 bg-gray-800 shadow-xl"
        >
          {/* Create tag section */}
          {isCreating ? (
            <div className="border-b border-gray-700 p-3">
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateTag();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTagName('');
                    setCreateError('');
                  }
                }}
                placeholder="Tag name..."
                className="mb-2 w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                autoFocus
                disabled={isSubmitting}
              />
              <div className="flex gap-2">
                <button
                  onClick={e => {
                    e.stopPropagation(); // Prevent lightbox from closing
                    handleCreateTag();
                  }}
                  disabled={!newTagName.trim() || isSubmitting}
                  className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation(); // Prevent lightbox from closing
                    setIsCreating(false);
                    setNewTagName('');
                    setCreateError('');
                  }}
                  className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="mt-2 text-xs text-red-400">{createError}</p>}
            </div>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation(); // Prevent lightbox from closing
                setIsCreating(true);
              }}
              className="w-full border-b border-gray-700 px-2 py-1 text-left text-xs text-blue-400 transition-colors hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
            >
              + Create New Tag
            </button>
          )}

          {/* Available tags */}
          <div className="p-2">
            {availableTags.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400">
                {isCreating ? 'Creating new tag...' : 'All tags are already applied'}
              </p>
            ) : (
              <div className="space-y-1">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={e => {
                      e.stopPropagation(); // Prevent lightbox from closing
                      handleSelect(tag.id);
                    }}
                    className="w-full rounded px-2 py-1 text-left text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
