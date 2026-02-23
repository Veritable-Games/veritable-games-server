'use client';

import { useState } from 'react';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { ReferenceImageId } from '@/types/project-references';
import { fetchJSON } from '@/lib/utils/csrf';

/**
 * Delete Image Confirmation Dialog
 * Confirms before permanently deleting a reference image
 */

interface DeleteImageDialogProps {
  projectSlug: string;
  imageId: ReferenceImageId | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export function DeleteImageDialog({
  projectSlug,
  imageId,
  onClose,
  onConfirm,
}: DeleteImageDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const removeImage = useReferencesStore(state => state.removeImage);
  const config = useReferencesStore(state => state.config);

  if (!imageId || !config) {
    return null;
  }

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);

    try {
      // Use config.uploadPath to construct the API endpoint
      const apiPath = config.uploadPath.replace('[slug]', projectSlug);
      await fetchJSON(`${apiPath}/${imageId}`, {
        method: 'DELETE',
      });

      // Remove from local store
      removeImage(imageId);

      // Callback if provided
      if (onConfirm) {
        onConfirm();
      }

      // Close dialog
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-6 w-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-lg font-semibold text-white">Delete Image?</h3>

        {/* Message */}
        <p className="mb-4 text-center text-gray-400">
          Are you sure you want to delete this image? This action cannot be undone.
        </p>

        {/* Error Display */}
        {error && (
          <div className="mb-4 rounded border border-red-500 bg-red-500/10 px-4 py-3 text-red-400">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 rounded bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
