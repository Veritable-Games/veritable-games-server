'use client';

import { useState } from 'react';
import type { ReferenceImageId } from '@/types/project-references';

interface SoftDeleteDialogProps {
  imageId: ReferenceImageId | null;
  imageName?: string;
  onConfirm: (imageId: ReferenceImageId) => Promise<void>;
  onCancel: () => void;
}

/**
 * Soft Delete Dialog Component
 *
 * Confirms soft-deletion of an image (hides from gallery, but can be recovered)
 * Shows undo notification after deletion
 */
export function SoftDeleteDialog({
  imageId,
  imageName = 'this image',
  onConfirm,
  onCancel,
}: SoftDeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!imageId) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
      setIsLoading(false);
    }
  };

  return (
    <dialog
      open={imageId !== null}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-xl font-bold text-white">Hide Image?</h2>

        <div className="mb-6 rounded border-l-4 border-blue-500 bg-gray-800/50 p-4">
          <p className="text-sm text-gray-300">
            <strong>"{imageName}"</strong> will be hidden from the gallery.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            💡 You can restore it anytime from the deleted items view.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/20 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 rounded bg-gray-700 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Hiding...' : 'Hide Image'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
