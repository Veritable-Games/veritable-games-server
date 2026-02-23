'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import { FileQueueItem } from './FileQueueItem';
import { BatchTaggingPanel } from './BatchTaggingPanel';
import { UploadProcessor } from '@/lib/upload/upload-processor';
import type { ReferenceTag } from '@/types/project-references';
import { logger } from '@/lib/utils/logger';

interface FileQueueManagerProps {
  projectSlug: string;
  allTags: ReferenceTag[];
  isAdmin: boolean;
}

/**
 * FileQueueManager Component
 * Manages upload queue with drag-and-drop reordering, progress tracking, and batch operations
 */
export function FileQueueManager({ projectSlug, allTags, isAdmin }: FileQueueManagerProps) {
  const {
    uploadQueue,
    batchTags,
    maxConcurrentUploads,
    updateQueuedFile,
    removeFileFromQueue,
    reorderQueuedFile,
    clearCompletedFiles,
    retryFailedFile,
    addImages,
    config,
  } = useReferencesStore();

  // Use ref to maintain the same processor instance across renders
  const processorRef = useRef<UploadProcessor | null>(null);

  // Initialize or update processor when config changes
  if (!processorRef.current || processorRef.current.projectSlug !== projectSlug) {
    processorRef.current = new UploadProcessor(projectSlug, maxConcurrentUploads, config);
  }

  const processor = processorRef.current;

  // Auto-start uploads when files are added to queue
  useEffect(() => {
    const pendingFiles = uploadQueue.filter(f => f.status === 'pending');

    if (pendingFiles.length > 0) {
      // Handle the promise properly to avoid unhandled rejections
      processor
        .processQueue(uploadQueue, {
          onProgress: (fileId, progress) => {
            updateQueuedFile(fileId, { progress });
          },
          onStatusChange: (fileId, status) => {
            updateQueuedFile(fileId, { status });
          },
          onSuccess: async (fileId, imageId, filePath) => {
            updateQueuedFile(fileId, {
              uploadedImageId: imageId,
              uploadedPath: filePath,
              completedAt: Date.now(),
            });

            // Fetch the full image data and add to gallery
            try {
              if (config) {
                const apiPath = config.uploadPath.replace('[slug]', projectSlug);
                const response = await fetch(`${apiPath}/${imageId}`);
                if (response.ok) {
                  const imageData = await response.json();
                  addImages([imageData]);
                }
              }
            } catch (error) {
              logger.error('Failed to fetch uploaded image:', error);
            }
          },
          onError: (fileId, error) => {
            updateQueuedFile(fileId, { error });
          },
        })
        .catch(error => {
          logger.error('Queue processing error:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      processor.cancelAllUploads();
    };
  }, [uploadQueue.length]); // Re-run when queue size changes

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, fileId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fileId);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent, targetFileId: string) => {
      e.preventDefault();
      const sourceFileId = e.dataTransfer.getData('text/plain');

      if (sourceFileId && sourceFileId !== targetFileId) {
        const targetIndex = uploadQueue.findIndex(f => f.id === targetFileId);
        if (targetIndex !== -1) {
          reorderQueuedFile(sourceFileId, targetIndex);
        }
      }
    },
    [uploadQueue, reorderQueuedFile]
  );

  // Handle retry
  const handleRetry = useCallback(
    (fileId: string) => {
      retryFailedFile(fileId);
    },
    [retryFailedFile]
  );

  // Handle remove
  const handleRemove = useCallback(
    (fileId: string) => {
      const file = uploadQueue.find(f => f.id === fileId);
      if (file?.status === 'uploading') {
        processor.cancelUpload(fileId);
      }
      removeFileFromQueue(fileId);
    },
    [uploadQueue, removeFileFromQueue]
  );

  // Keyboard navigation - Move up
  const handleMoveUp = useCallback(
    (fileId: string) => {
      const currentIndex = uploadQueue.findIndex(f => f.id === fileId);
      if (currentIndex > 0) {
        reorderQueuedFile(fileId, currentIndex - 1);
      }
    },
    [uploadQueue, reorderQueuedFile]
  );

  // Keyboard navigation - Move down
  const handleMoveDown = useCallback(
    (fileId: string) => {
      const currentIndex = uploadQueue.findIndex(f => f.id === fileId);
      if (currentIndex < uploadQueue.length - 1) {
        reorderQueuedFile(fileId, currentIndex + 1);
      }
    },
    [uploadQueue, reorderQueuedFile]
  );

  if (uploadQueue.length === 0) {
    return null;
  }

  const pendingCount = uploadQueue.filter(f => f.status === 'pending').length;
  const activeCount = uploadQueue.filter(f =>
    ['validating', 'uploading', 'processing'].includes(f.status)
  ).length;
  const completedCount = uploadQueue.filter(f => f.status === 'success').length;
  const failedCount = uploadQueue.filter(f => f.status === 'error').length;

  return (
    <div className="mt-6 space-y-4" role="region" aria-label="Upload queue manager">
      {/* Live region for status announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {pendingCount > 0 && `${pendingCount} files pending upload`}
        {activeCount > 0 && `, ${activeCount} currently uploading`}
        {completedCount > 0 && `, ${completedCount} completed`}
        {failedCount > 0 && `, ${failedCount} failed`}
      </div>

      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">Upload Queue</h3>
          <div className="flex items-center gap-3 text-sm">
            {pendingCount > 0 && <span className="text-gray-400">{pendingCount} pending</span>}
            {activeCount > 0 && <span className="text-blue-400">{activeCount} uploading</span>}
            {completedCount > 0 && (
              <span className="text-green-400">{completedCount} completed</span>
            )}
            {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
          </div>
        </div>

        {/* Actions */}
        {completedCount > 0 && (
          <button
            onClick={clearCompletedFiles}
            className="text-sm text-gray-400 transition-colors hover:text-white"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Batch tagging panel (only for pending files) */}
      {pendingCount > 0 && isAdmin && <BatchTaggingPanel allTags={allTags} />}

      {/* Queue items */}
      <ul className="space-y-2" role="list" aria-label="Upload queue items">
        {uploadQueue.map(queuedFile => (
          <li key={queuedFile.id}>
            <FileQueueItem
              queuedFile={queuedFile}
              allTags={allTags}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onRetry={handleRetry}
              onRemove={handleRemove}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDateCreatedChange={(fileId, dateCreated) =>
                updateQueuedFile(fileId, { dateCreated })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
