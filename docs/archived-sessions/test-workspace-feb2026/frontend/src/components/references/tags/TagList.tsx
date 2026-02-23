'use client';

import { useState } from 'react';
import { TagChip } from './TagChip';
import type { ReferenceTag, ReferenceTagId } from '@/types/project-references';

interface TagListProps {
  tags: ReferenceTag[];
  maxVisible?: number;
  isAdmin?: boolean;
  selectedTagIds?: Set<ReferenceTagId>;
  removingTagIds?: Set<ReferenceTagId>;
  onTagClick?: (tagId: ReferenceTagId) => void;
}

/**
 * TagList - Displays a list of tags with expand/collapse functionality
 * Supports admin multi-tag selection (red highlight) and deletion animation
 */
export function TagList({
  tags,
  maxVisible = 5,
  isAdmin = false,
  selectedTagIds = new Set(),
  removingTagIds = new Set(),
  onTagClick,
}: TagListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tags.length === 0) {
    return <div className="py-1 text-xs italic text-gray-500">No tags yet</div>;
  }

  const visibleTags = isExpanded ? tags : tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;
  const showExpandButton = !isExpanded && hiddenCount > 0;

  return (
    <div
      role="list"
      className="flex flex-wrap items-center gap-1"
      aria-label={`${tags.length} tags applied`}
    >
      {visibleTags.map(tag => (
        <div role="listitem" key={tag.id}>
          <TagChip
            tag={tag}
            isAdmin={isAdmin}
            isSelected={selectedTagIds.has(tag.id)}
            isRemoving={removingTagIds.has(tag.id)}
            onClick={onTagClick}
          />
        </div>
      ))}

      {showExpandButton && (
        <button
          onClick={e => {
            e.stopPropagation(); // Prevent lightbox from closing
            setIsExpanded(true);
          }}
          className="inline-flex shrink-0 items-center rounded-full border border-gray-600 bg-gray-800/50 px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-800/70 hover:text-gray-300"
          aria-expanded={false}
          aria-label={`Show ${hiddenCount} more tags`}
          style={{ minHeight: '24px' }}
        >
          +{hiddenCount} more
        </button>
      )}

      {isExpanded && hiddenCount > 0 && (
        <button
          onClick={e => {
            e.stopPropagation(); // Prevent lightbox from closing
            setIsExpanded(false);
          }}
          className="inline-flex shrink-0 items-center rounded-full border border-gray-600 bg-gray-800/50 px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-800/70 hover:text-gray-300"
          aria-expanded={true}
          aria-label="Show fewer tags"
          style={{ minHeight: '24px' }}
        >
          show less
        </button>
      )}
    </div>
  );
}
