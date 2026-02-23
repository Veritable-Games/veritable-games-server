'use client';

import { useState } from 'react';
import type { ReferenceImage, ReferenceImageId } from '@/types/project-references';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/utils/logger';

interface DeletedItemsViewProps {
  deletedImages: ReferenceImage[];
  onRestore: (imageId: ReferenceImageId) => Promise<void>;
  onPermanentlyDelete: (imageId: ReferenceImageId) => Promise<void>;
}

/**
 * Deleted Items View Component
 *
 * Shows soft-deleted images for admins
 * Allows restore or permanent delete operations
 */
export function DeletedItemsView({
  deletedImages,
  onRestore,
  onPermanentlyDelete,
}: DeletedItemsViewProps) {
  const [restoringId, setRestoringId] = useState<ReferenceImageId | null>(null);
  const [deletingId, setDeletingId] = useState<ReferenceImageId | null>(null);
  const [expandedId, setExpandedId] = useState<ReferenceImageId | null>(null);

  if (deletedImages.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-4 py-12 text-center">
        <p className="text-gray-400">No deleted images</p>
      </div>
    );
  }

  const handleRestore = async (imageId: ReferenceImageId) => {
    setRestoringId(imageId);
    try {
      await onRestore(imageId);
    } catch (error) {
      logger.error('Failed to restore image:', error);
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (imageId: ReferenceImageId) => {
    if (!window.confirm('Permanently delete this image? This cannot be undone.')) {
      return;
    }

    setDeletingId(imageId);
    try {
      await onPermanentlyDelete(imageId);
    } catch (error) {
      logger.error('Failed to permanently delete image:', error);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {deletedImages.map(image => (
        <div
          key={image.id}
          className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3 transition-colors hover:border-gray-600"
        >
          {/* Thumbnail */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-gray-700 bg-gray-900">
            <img
              src={image.file_path}
              alt={image.filename_storage}
              className="h-full w-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400">
              DELETED
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-200">{image.filename_storage}</p>
            <p className="text-xs text-gray-500">
              {image.deleted_at && (
                <>
                  Deleted{' '}
                  {formatDistanceToNow(new Date(image.deleted_at), {
                    addSuffix: true,
                  })}
                </>
              )}
            </p>
            {image.file_size && (
              <p className="text-xs text-gray-600">
                {(image.file_size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => handleRestore(image.id)}
              disabled={restoringId === image.id || deletingId !== null}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restoringId === image.id ? '...' : '↶ Restore'}
            </button>

            <button
              onClick={() => handlePermanentDelete(image.id)}
              disabled={deletingId === image.id || restoringId !== null}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId === image.id ? '...' : '🗑️'}
            </button>

            <button
              onClick={() => setExpandedId(expandedId === image.id ? null : image.id)}
              className="px-2 py-1.5 text-gray-400 transition-colors hover:text-gray-300"
            >
              {expandedId === image.id ? '▼' : '▶'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
