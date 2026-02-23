'use client';

import { useState } from 'react';
import type { ReferenceImageId } from '@/types/project-references';

interface PermanentDeleteDialogProps {
  imageId: ReferenceImageId | null;
  imageName?: string;
  fileSize?: number;
  onConfirm: (imageId: ReferenceImageId) => Promise<void>;
  onCancel: () => void;
}

type DeleteReason = 'duplicate' | 'wrong' | 'spam' | 'other' | '';

/**
 * Permanent Delete Dialog Component
 *
 * Confirms permanent deletion of an image (irreversible)
 * Requires explicit confirmation and reason selection
 * Admin-only operation
 */
export function PermanentDeleteDialog({
  imageId,
  imageName = 'this image',
  fileSize,
  onConfirm,
  onCancel,
}: PermanentDeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<DeleteReason>('');

  if (!imageId) return null;

  const handleConfirm = async () => {
    if (!confirmed || !reason) return;

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
      setIsLoading(false);
    }
  };

  const fileSizeStr = fileSize
    ? fileSize > 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(fileSize / 1024).toFixed(2)} KB`
    : '';

  return (
    <dialog
      open={imageId !== null}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-1 text-xl font-bold text-white">⚠️ Permanently Delete?</h2>
        <p className="mb-4 text-sm text-gray-400">This action cannot be undone</p>

        {/* Warning Box */}
        <div className="mb-4 rounded border border-l-4 border-red-700 bg-red-900/20 p-4">
          <ul className="space-y-1 text-sm text-red-200">
            <li>✗ Image will be deleted from disk</li>
            <li>✗ Database record will be removed</li>
            <li>✗ Cannot be restored (unless backup exists)</li>
            {fileSizeStr && <li>✗ Frees {fileSizeStr} of storage</li>}
          </ul>
        </div>

        {/* Reason Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Why are you deleting this image?
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value as DeleteReason)}
            disabled={isLoading}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">Select a reason...</option>
            <option value="duplicate">Duplicate</option>
            <option value="wrong">Wrong file uploaded</option>
            <option value="spam">Spam/Abuse</option>
            <option value="other">Other reason</option>
          </select>
        </div>

        {/* Confirmation Checkbox */}
        <div className="mb-4 rounded border border-gray-700 bg-gray-800/50 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 accent-red-600 disabled:opacity-50"
            />
            <span className="text-sm text-gray-300">
              I understand this is permanent and cannot be undone
            </span>
          </label>
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
            disabled={isLoading || !confirmed || !reason}
            className="flex-1 rounded bg-red-700 px-4 py-2 font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : '🗑️ Delete Forever'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
