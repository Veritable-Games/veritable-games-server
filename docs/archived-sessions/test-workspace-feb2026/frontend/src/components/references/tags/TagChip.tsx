'use client';

import type { ReferenceTag, ReferenceTagId } from '@/types/project-references';

interface TagChipProps {
  tag: ReferenceTag;
  isAdmin?: boolean;
  isSelected?: boolean;
  isRemoving?: boolean;
  onClick?: (tagId: ReferenceTagId) => void;
}

/**
 * TagChip - Tag display component
 * Admin can click to select (turns red), then Delete key to remove
 * Regular users see read-only tags
 */
export function TagChip({
  tag,
  isAdmin = false,
  isSelected = false,
  isRemoving = false,
  onClick,
}: TagChipProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent lightbox from closing
    if (isAdmin && onClick) {
      onClick(tag.id);
    }
  };

  // For admin users, render as button
  if (isAdmin) {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-xs transition-all duration-300 ${
          isRemoving ? 'max-w-0 scale-75 overflow-hidden px-0 opacity-0' : 'scale-100 opacity-100'
        } ${
          isSelected
            ? 'border-red-500 bg-red-600/50 text-red-200 hover:bg-red-600/70'
            : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
        }`}
        style={isRemoving ? { margin: 0, minHeight: '24px' } : { minHeight: '24px' }}
      >
        <span className="leading-none">{tag.name}</span>
      </button>
    );
  }

  // For regular users, render as read-only span
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-gray-600 bg-gray-800/50 px-1.5 py-0.5 text-xs text-gray-300"
      style={{ minHeight: '24px' }}
    >
      <span className="leading-none">{tag.name}</span>
    </span>
  );
}
