'use client';

import { useState, useEffect, useRef } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { ReferenceTag, ReferenceTagId, ReferenceCategoryId } from '@/types/project-references';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

/**
 * Tag Filter Component
 * Card with tag selection and creation
 * Admin keyboard shortcuts:
 * - Delete: Delete selected tags with smooth animation
 * - Esc: Deselect all selected tags
 */

interface TagFiltersProps {
  projectSlug: string;
  isAdmin: boolean;
}

export function TagFilters({ projectSlug, isAdmin }: TagFiltersProps) {
  const { selectedTags, toggleTag, clearTags, setAllTags, allTags, config, sortBy, setSortBy } =
    useReferencesStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingTags, setRemovingTags] = useState<Set<ReferenceTagId>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

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

      // OPTIMISTIC UPDATE: Add new tag to UI immediately
      if (response.tag_id) {
        const newTag = {
          id: response.tag_id as unknown as ReferenceTagId,
          name: newTagName.trim(),
          color: '#808080', // Default gray color for new tags
          category: { id: 'general' as unknown as ReferenceCategoryId, name: 'General' },
          display_order: allTags.length,
        } as ReferenceTag;
        setAllTags([...allTags, newTag]);
      }

      setNewTagName('');
      setIsCreating(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard-based tag deletion (admin only) with smooth animation
  // Deletes ALL selected tags simultaneously
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Escape key: deselect all tags
      if (
        e.key === 'Escape' &&
        selectedTags.length > 0 &&
        !isCreating &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        clearTags();
        return;
      }

      // Delete key: delete all selected tags
      if (
        e.key === 'Delete' &&
        selectedTags.length > 0 &&
        !isCreating &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();

        // Get all selected tags to delete
        const tagsToDelete = allTags.filter(t => selectedTags.includes(t.id));
        if (tagsToDelete.length === 0) return;

        // Mark all tags as removing (triggers animation)
        setRemovingTags(prev => {
          const next = new Set(prev);
          tagsToDelete.forEach(tag => next.add(tag.id));
          return next;
        });

        // Clear all selections immediately
        clearTags();

        // Wait for animation to complete, then remove from DOM
        setTimeout(() => {
          const newTags = allTags.filter(t => !tagsToDelete.some(dt => dt.id === t.id));
          setAllTags(newTags);
          setRemovingTags(prev => {
            const next = new Set(prev);
            tagsToDelete.forEach(tag => next.delete(tag.id));
            return next;
          });
        }, 300); // Match CSS transition duration

        // Delete all tags in background (parallel requests)
        const apiPath = config?.uploadPath.replace('[slug]', projectSlug);
        const deletePromises = tagsToDelete.map(tag =>
          fetchJSON(`${apiPath}/tags/${tag.id}`, {
            method: 'DELETE',
          }).catch(error => {
            logger.error(`Failed to delete tag ${tag.name}:`, error);
            return { error, tagId: tag.id };
          })
        );

        // Wait for all deletions
        const results = await Promise.all(deletePromises);

        // Check for errors and rollback if needed
        const failedTags = results.filter(r => r && 'error' in r);
        if (failedTags.length > 0) {
          logger.error(`Failed to delete ${failedTags.length} tags`);
          // Could implement rollback here if needed
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedTags, allTags, isCreating, projectSlug, setAllTags, toggleTag, clearTags]);

  // Note: Delete and Esc keys used for tag management
  // Backspace not used to avoid conflicts with browser back navigation

  // Get sort label based on gallery type
  const getSortLabel = (value: 'default' | 'dimensions') => {
    if (value === 'dimensions') return 'Dimensions';

    // Default label depends on gallery type
    if (config?.galleryType === 'history') return 'Date';
    return 'Tags';
  };

  return (
    <div ref={containerRef} className="rounded-lg border border-gray-700 bg-gray-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-200">Filter by Tags</h2>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm text-gray-400">
              Sort:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'default' | 'dimensions')}
              className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-300 transition-colors hover:border-gray-500 focus:border-blue-500 focus:outline-none"
            >
              <option value="default">{getSortLabel('default')}</option>
              <option value="dimensions">Dimensions</option>
            </select>
          </div>
        </div>

        {selectedTags.length > 0 && (
          <button
            onClick={clearTags}
            className="text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            Clear ({selectedTags.length})
          </button>
        )}
      </div>

      {/* Create Tag Input */}
      {isCreating && (
        <div className="mb-4 rounded border border-gray-600 bg-gray-800/50 p-3">
          <div className="flex gap-2">
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
              className="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              autoFocus
              disabled={isSubmitting}
            />
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isSubmitting}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
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
      )}

      {/* Tag Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {allTags.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tags yet. {isAdmin && 'Create one to get started.'}
          </p>
        ) : (
          <>
            {allTags.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              const isRemoving = removingTags.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded border px-2 py-1 text-sm transition-all duration-300 ${
                    isRemoving
                      ? 'max-w-0 scale-75 overflow-hidden px-0 opacity-0'
                      : 'scale-100 opacity-100'
                  } ${
                    isSelected
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                  }`}
                  style={isRemoving ? { margin: 0 } : undefined}
                >
                  {tag.name}
                </button>
              );
            })}

            {/* Inline "+ New Tag" button (admin only) */}
            {isAdmin && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="rounded border border-dashed border-gray-600 px-2 py-1 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300"
              >
                + New Tag
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
