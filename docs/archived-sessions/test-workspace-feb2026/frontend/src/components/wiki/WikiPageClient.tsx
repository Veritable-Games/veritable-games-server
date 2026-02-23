'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InlineTagEditor from '@/components/wiki/InlineTagEditor';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface WikiPageClientProps {
  pageSlug: string;
  pageId: number;
  pageTitle: string;
  pageCreatedBy: number;
  initialTags: Array<{ id: number; name: string; color?: string }>;
  allTags: Array<{ id: number; name: string; color?: string }>;
  canEdit: boolean;
  canDelete: boolean;
  userId?: number;
  userRole?: string;
  createdAt: string;
  username?: string;
  displayName?: string;
}

/**
 * WikiPageClient - Client component for interactive features
 * Handles tag editing, delete modal, and page footer actions
 */
export function WikiPageClient({
  pageSlug,
  pageId,
  pageTitle,
  pageCreatedBy,
  initialTags,
  allTags,
  canEdit,
  canDelete,
  userId,
  userRole,
  createdAt,
  username,
  displayName,
}: WikiPageClientProps) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTagsChange = (newTags: Array<{ id: number; name: string; color?: string }>) => {
    setTags(newTags);
  };

  const handleDeletePage = async () => {
    if (!userId || deleting) return;

    try {
      setDeleting(true);

      const data = await fetchJSON(`/api/wiki/pages/${pageSlug}?authorId=${userId}`, {
        method: 'DELETE',
      });

      if (data.success) {
        router.push('/wiki');
        router.refresh(); // Force server re-fetch to show updated category counts
      } else {
        logger.error('Delete failed', { pageSlug, error: data.error });
        setShowDeleteModal(false);
        throw new Error(data.error || 'Failed to delete page');
      }
    } catch (err) {
      logger.error('Error deleting page', { pageSlug, error: err });
      setShowDeleteModal(false);
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Tag Editor */}
      <InlineTagEditor
        pageSlug={pageSlug}
        initialTags={tags}
        allTags={allTags}
        canEdit={canEdit}
        onTagsChange={handleTagsChange}
      />

      {/* Page Footer */}
      <div className="mt-4 border-t border-gray-700 pt-6">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div>
            <p>
              Created on {new Date(createdAt).toLocaleDateString()}
              {username && ` by ${displayName || username}`}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href={`/wiki/${encodeURIComponent(pageSlug)}/history`}
              className="text-sm transition-colors hover:text-blue-400"
            >
              View History
            </Link>
            {/* Show edit button only for authenticated users with permission */}
            {canEdit && (
              <Link
                href={`/wiki/${encodeURIComponent(pageSlug)}/edit`}
                className="text-sm transition-colors hover:text-blue-400"
              >
                Edit Page
              </Link>
            )}

            {/* Show delete button for page creators and admins */}
            {userId && canDelete && (userRole === 'admin' || userId === pageCreatedBy) && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-sm text-gray-300 transition-colors hover:text-red-400"
                title={
                  userRole === 'admin'
                    ? 'Delete this page (admin privilege)'
                    : 'Delete this page (page creator only)'
                }
              >
                Delete Page
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={e => {
            // Close modal if clicking the backdrop
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="mb-4 flex items-center text-xl font-bold text-white">
              <svg
                className="mr-2 h-6 w-6 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              Delete Wiki Page
            </h3>
            <p className="mb-4 text-gray-300">
              Are you sure you want to delete "<strong className="text-white">{pageTitle}</strong>"?
            </p>
            <div className="mb-6 rounded border border-red-700/50 bg-red-900/30 p-3">
              <p className="text-sm text-red-200">
                <strong className="text-red-300">Warning:</strong> This action cannot be undone and
                will permanently remove the page and all its revision history.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="rounded border border-gray-600 bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-600 hover:text-white disabled:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeletePage();
                }}
                disabled={deleting}
                className="rounded border border-red-600 bg-red-700 px-4 py-2 font-medium text-white transition-colors hover:border-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Deleting...
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
