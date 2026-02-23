'use client';

import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { ReferenceTag } from '@/types/project-references';

interface BatchTaggingPanelProps {
  allTags: ReferenceTag[];
}

/**
 * BatchTaggingPanel Component
 * Allows assigning tags to all pending files in the upload queue
 */
export function BatchTaggingPanel({ allTags }: BatchTaggingPanelProps) {
  const { batchTags, toggleBatchTag, applyBatchTagsToQueue } = useReferencesStore();

  if (allTags.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Batch Tag Assignment</h4>
        {batchTags.length > 0 && (
          <button
            onClick={applyBatchTagsToQueue}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-700"
          >
            Apply to all pending
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-gray-400">Select tags to apply to all pending uploads</p>

      <div className="flex flex-wrap gap-2">
        {allTags.map(tag => {
          const isSelected = batchTags.includes(tag.id);

          return (
            <button
              key={tag.id}
              onClick={() => toggleBatchTag(tag.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              } `}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} tag: ${tag.name}`}
            >
              {tag.name}
              {isSelected && (
                <span className="ml-1.5" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {batchTags.length > 0 && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <p className="text-xs text-gray-400">
            Selected tags will be applied to new files added to the queue
          </p>
        </div>
      )}
    </div>
  );
}
