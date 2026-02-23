'use client';

import { useState } from 'react';
import type { QueuedFile } from '@/lib/stores/referencesStore';
import type { ReferenceTag } from '@/types/project-references';

interface FileQueueItemProps {
  queuedFile: QueuedFile;
  allTags: ReferenceTag[];
  onDragStart: (e: React.DragEvent, fileId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, fileId: string) => void;
  onRetry: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onMoveUp?: (fileId: string) => void;
  onMoveDown?: (fileId: string) => void;
  onDateCreatedChange?: (fileId: string, dateCreated: string | undefined) => void;
}

/**
 * FileQueueItem Component
 * Individual file in upload queue with preview, progress, and actions
 */
export function FileQueueItem({
  queuedFile,
  allTags,
  onDragStart,
  onDragOver,
  onDrop,
  onRetry,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDateCreatedChange,
}: FileQueueItemProps) {
  const { id, file, preview, status, progress, tags, error, dateCreated } = queuedFile;
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (status !== 'pending') return; // Only allow reordering pending files

    switch (e.key) {
      case 'ArrowUp':
        if (e.altKey && onMoveUp) {
          e.preventDefault();
          onMoveUp(id);
        }
        break;
      case 'ArrowDown':
        if (e.altKey && onMoveDown) {
          e.preventDefault();
          onMoveDown(id);
        }
        break;
    }
  };

  // Status display
  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return { text: 'Pending', color: 'text-gray-400' };
      case 'validating':
        return { text: 'Validating...', color: 'text-blue-400' };
      case 'uploading':
        return { text: `Uploading ${progress}%`, color: 'text-blue-400' };
      case 'processing':
        return { text: 'Processing...', color: 'text-blue-400' };
      case 'success':
        return { text: 'Complete', color: 'text-green-400' };
      case 'error':
        return { text: 'Failed', color: 'text-red-400' };
      case 'cancelled':
        return { text: 'Cancelled', color: 'text-gray-500' };
      default:
        return { text: status, color: 'text-gray-400' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const isActive = ['validating', 'uploading', 'processing'].includes(status);
  const canRetry = status === 'error';
  const canRemove = !isActive;
  const canDrag = status === 'pending';

  // Get tag names
  const tagNames = tags.map(tagId => allTags.find(t => t.id === tagId)?.name).filter(Boolean);

  return (
    <div
      draggable={canDrag}
      onDragStart={e => canDrag && onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, id)}
      onKeyDown={handleKeyDown}
      tabIndex={canDrag ? 0 : -1}
      className={`relative flex items-center gap-4 rounded-lg border p-4 transition-all ${canDrag ? 'cursor-move outline-none hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50' : 'cursor-default'} ${status === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-gray-700 bg-gray-900/50'} `}
      aria-label={`${file.name} - ${statusDisplay.text}${canDrag ? '. Press Alt+Arrow Up or Down to reorder' : ''}`}
    >
      {/* Drag handle (only visible when draggable) */}
      {canDrag && (
        <div className="flex-shrink-0 text-gray-500" aria-hidden="true">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
      )}

      {/* Preview thumbnail */}
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-800">
        {preview ? (
          <img src={preview} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="min-w-0 flex-grow">
        <div className="mb-1 flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{file.name}</p>
          <span className={`text-xs font-medium ${statusDisplay.color}`}>{statusDisplay.text}</span>
        </div>

        {/* File size and tags */}
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          {tagNames.length > 0 && (
            <>
              <span>•</span>
              <span className="truncate">{tagNames.join(', ')}</span>
            </>
          )}
        </div>

        {/* Date Created for old backups - only show if pending */}
        {status === 'pending' && (
          <div className="mb-2">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-xs text-gray-500 transition-colors hover:text-gray-300"
              type="button"
            >
              {dateCreated ? `📅 Date: ${dateCreated}` : '📅 Set original date (for backups)'}
            </button>

            {showDatePicker && (
              <div className="mt-2 rounded border border-gray-700 bg-gray-800 p-2">
                <label className="mb-1 block text-xs text-gray-400">
                  Original creation date (if from old backup):
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateCreated || ''}
                    onChange={e => {
                      const newDate = e.target.value || undefined;
                      onDateCreatedChange?.(id, newDate);
                    }}
                    className="flex-grow rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      onDateCreatedChange?.(id, undefined);
                      setShowDatePicker(false);
                    }}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600"
                    type="button"
                    title="Clear date"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar (only show when uploading) */}
        {isActive && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Upload progress: ${progress}%`}
            />
          </div>
        )}

        {/* Error message */}
        {status === 'error' && error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {canRetry && (
          <button
            onClick={() => onRetry(id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            aria-label="Retry upload"
            title="Retry upload"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}

        {canRemove && (
          <button
            onClick={() => onRemove(id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400"
            aria-label="Remove from queue"
            title="Remove from queue"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Success checkmark */}
        {status === 'success' && (
          <div className="p-2 text-green-400" aria-label="Upload successful">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
