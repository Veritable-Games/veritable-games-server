'use client';

import { useEffect, useRef, useState } from 'react';
import { TagList } from './TagList';
import { TagActions } from './TagActions';
import type { ReferenceTag, ReferenceTagId } from '@/types/project-references';

interface TagStripProps {
  tags: ReferenceTag[];
  allTags: ReferenceTag[];
  onAdd?: (tagId: ReferenceTagId) => Promise<void>;
  onRemove?: (tagId: ReferenceTagId) => Promise<void>;
  isLoading?: boolean;
  projectSlug?: string;
  onTagsRefresh?: () => Promise<void>;
}

/**
 * TagStrip - Horizontal tag display with add/remove functionality
 * Admin can click to select multiple tags (turn red), then:
 * - Press Delete to remove selected tags from image
 * - Press Esc to deselect all tags (takes priority over closing lightbox)
 *
 * In lightbox context:
 * - Esc with tags selected: deselects tags (lightbox stays open)
 * - Esc with no tags selected: delegates to ImageLightbox (resets zoom or closes)
 *
 * Note: Backspace not used to avoid conflicts with browser back navigation
 */
export function TagStrip({
  tags,
  allTags,
  onAdd,
  onRemove,
  isLoading,
  projectSlug,
  onTagsRefresh,
}: TagStripProps) {
  const isAdmin = onAdd !== undefined || onRemove !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<ReferenceTagId>>(new Set());
  const [removingTagIds, setRemovingTagIds] = useState<Set<ReferenceTagId>>(new Set());

  // Keyboard-based tag management (admin only)
  // Priority-based Esc handling: deselect tags OR close lightbox (context-aware)
  useEffect(() => {
    if (!isAdmin || !onRemove) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Escape key: deselect all tags (takes priority over closing lightbox)
      // stopPropagation prevents ImageLightbox's Esc handler from firing
      if (
        e.key === 'Escape' &&
        selectedTagIds.size > 0 &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        e.stopPropagation(); // Prevent ImageLightbox from closing when tags are selected
        setSelectedTagIds(new Set());
        return;
      }

      // Delete key: remove selected tags from image
      if (
        e.key === 'Delete' &&
        selectedTagIds.size > 0 &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();

        const tagsToRemove = tags.filter(t => selectedTagIds.has(t.id));
        if (tagsToRemove.length === 0) return;

        // Mark all tags as removing (triggers animation)
        setRemovingTagIds(new Set(selectedTagIds));
        setSelectedTagIds(new Set());

        // Wait for animation, then remove all
        setTimeout(async () => {
          // Remove tags SEQUENTIALLY to avoid stale closure race condition
          // Each removal sees the updated state from the previous removal
          for (const tag of tagsToRemove) {
            await onRemove(tag.id);
          }
          setRemovingTagIds(new Set());
        }, 300);
      }
    };

    // Use capture phase to ensure this handler fires BEFORE ImageLightbox's handler
    // This allows stopPropagation() to actually prevent the lightbox from closing
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isAdmin, tags, selectedTagIds, onRemove]);

  const handleTagClick = (tagId: ReferenceTagId) => {
    if (!isAdmin) return;
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Image tags"
      className="relative flex items-center gap-2"
    >
      <TagList
        tags={tags}
        maxVisible={5}
        isAdmin={isAdmin}
        selectedTagIds={selectedTagIds}
        removingTagIds={removingTagIds}
        onTagClick={handleTagClick}
      />

      {isAdmin && onAdd && projectSlug && onTagsRefresh && (
        <TagActions
          allTags={allTags}
          selectedTagIds={tags.map(t => t.id)}
          onAdd={onAdd}
          isLoading={isLoading}
          projectSlug={projectSlug}
          onTagsRefresh={onTagsRefresh}
        />
      )}
    </div>
  );
}
