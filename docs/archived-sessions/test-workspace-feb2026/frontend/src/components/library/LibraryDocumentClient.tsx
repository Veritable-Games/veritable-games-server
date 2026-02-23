'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TagEditor from '@/components/wiki/TagEditor';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface LibraryDocumentClientProps {
  documentSlug: string;
  documentId: string | number;
  documentTitle: string;
  documentCreatedBy?: string | number;
  documentSource?: 'library' | 'anarchist'; // Source of document for routing
  initialTags: Array<{ id: number; name: string; color?: string }>;
  allTags: Array<{ id: number; name: string; color?: string }>;
  canEdit: boolean;
  canDelete: boolean;
  userId?: number;
  userRole?: string;
  createdAt: string;
  updatedAt: string;
}

export function LibraryDocumentClient({
  documentSlug,
  documentId,
  documentTitle,
  documentCreatedBy,
  documentSource = 'library',
  initialTags,
  allTags,
  canEdit,
  canDelete,
  userId,
  userRole,
  createdAt,
  updatedAt,
}: LibraryDocumentClientProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tags, setTags] = useState(initialTags);

  const handleTagsChange = (newTags: Array<{ id: number; name: string; color?: string }>) => {
    setTags(newTags);
  };

  const handleDelete = async () => {
    if (!userId) return;

    setDeleting(true);

    try {
      // Route to appropriate delete endpoint based on document source
      const endpoint =
        documentSource === 'anarchist'
          ? `/api/documents/anarchist/${encodeURIComponent(documentSlug)}`
          : `/api/library/documents/${encodeURIComponent(documentSlug)}`;

      const data = await fetchJSON(endpoint, {
        method: 'DELETE',
      });

      if (data.success) {
        router.push('/library');
      } else {
        alert(data.error || 'Failed to delete document');
      }
    } catch (error) {
      logger.error('Error deleting document:', error);
      alert('Failed to delete document');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
      {/* Tag Editor */}
      <TagEditor
        pageSlug={documentSlug}
        initialTags={tags}
        allTags={allTags}
        canEdit={canEdit}
        onTagsChange={handleTagsChange}
        apiPrefix={
          documentSource === 'anarchist' ? '/api/documents/anarchist' : '/api/library/documents'
        }
      />

      {/* Page Footer */}
      <div className="mt-4 border-t border-gray-700 pt-6">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div>
            <p>Last updated on {formatDate(updatedAt)}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href={`/library/${documentSlug}/history`}
              className="text-sm transition-colors hover:text-blue-400"
            >
              View History
            </Link>

            {/* Show edit button only for authenticated users with permission */}
            {canEdit && (
              <Link
                href={`/library/${documentSlug}/edit`}
                className="text-sm transition-colors hover:text-blue-400"
              >
                Edit Document
              </Link>
            )}

            {/* Show delete button for admins and document creators */}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-sm text-gray-300 transition-colors hover:text-red-400"
                title="Delete this document"
              >
                Delete Document
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">Delete Library Document</h3>
            <p className="mb-6 text-gray-300">
              Are you sure you want to delete "{documentTitle}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex h-8 items-center rounded border border-red-500/50 bg-gray-800/40 px-3 text-sm text-red-400 transition-colors hover:border-red-400/70 hover:bg-gray-700/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
