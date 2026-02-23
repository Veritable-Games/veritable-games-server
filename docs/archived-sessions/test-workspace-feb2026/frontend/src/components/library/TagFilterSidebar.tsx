'use client';

import { useState, useEffect } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import { LanguageIcon } from '@heroicons/react/24/outline';
import { getLanguageName } from '@/lib/documents/types';
import type { LanguageInfo } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

interface Tag {
  id: number;
  name: string;
  usage_count: number;
}

interface TagFilterSidebarProps {
  tags: Tag[];
  selectedTags: string[];
  onTagToggle: (tagName: string) => void;
  onClearFilters: () => void;
  user?: { id: number; role: string } | null;
  onRefreshTags?: () => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  isLoadingDocuments?: boolean;
}

export function TagFilterSidebar({
  tags,
  selectedTags,
  onTagToggle,
  onClearFilters,
  user,
  onRefreshTags,
  selectedLanguage,
  onLanguageChange,
  isLoadingDocuments = false,
}: TagFilterSidebarProps) {
  // UI state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Tag deletion state (admin only)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Language state
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(true);

  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  // Fetch available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        setLoadingLanguages(true);
        const response = await fetch('/api/documents/languages');
        if (response.ok) {
          const result = await response.json();
          setLanguages(result.data || []);
        }
      } catch (error) {
        logger.error('Failed to fetch languages:', error);
      } finally {
        setLoadingLanguages(false);
      }
    };

    fetchLanguages();
  }, []);

  // Delete key listener (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedTags.length > 0) {
        setShowDeleteModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, selectedTags]);

  const handleClear = () => {
    onClearFilters();
    setIsMobileOpen(false);
  };

  // Group languages by common ones first
  const majorLanguages = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const sortedLanguages = languages.sort((a, b) => {
    const aIsMajor = majorLanguages.includes(a.code);
    const bIsMajor = majorLanguages.includes(b.code);
    if (aIsMajor && !bIsMajor) return -1;
    if (!aIsMajor && bIsMajor) return 1;
    return b.document_count - a.document_count;
  });

  // Handle tag deletion (admin only)
  const handleDeleteTags = async () => {
    if (!isAdmin || selectedTags.length === 0 || isDeleting) return;

    setIsDeleting(true);
    try {
      const failedDeletions: string[] = [];

      // Delete each selected tag
      for (const tagName of selectedTags) {
        const tag = tags.find(t => t.name === tagName);
        if (!tag) continue;

        const response = await fetchJSON(`/api/library/tags/${tag.id}`, {
          method: 'DELETE',
        });

        if (!response.success) {
          failedDeletions.push(tagName);
        }
      }

      // Show results
      if (failedDeletions.length > 0) {
        alert(`Failed to delete ${failedDeletions.length} tag(s): ${failedDeletions.join(', ')}`);
      }

      // Refresh tags list
      setShowDeleteModal(false);
      onRefreshTags?.();
      onClearFilters(); // Clear selection
    } catch (error) {
      logger.error('Failed to delete tags:', error);
      alert('Failed to delete tags');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-blue-600 px-4 py-2 text-white shadow-lg md:hidden"
      >
        {isMobileOpen ? 'Hide Filters' : 'Show Filters'}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-full flex-col border border-gray-700/50 bg-gray-900/70 transition-transform duration-300 md:sticky md:h-full md:rounded-lg ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} `}
      >
        <div className="flex-shrink-0 space-y-4 p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Filter by tag</h3>
            {selectedTags.length > 0 && (
              <button
                onClick={handleClear}
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Active filters count */}
          {selectedTags.length > 0 && (
            <div className="text-sm text-gray-400">
              {selectedTags.length} filter{selectedTags.length !== 1 ? 's' : ''} active
            </div>
          )}

          {/* Language Filter */}
          <div className="border-t border-gray-700/50 pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              <LanguageIcon className="h-4 w-4" />
              Language
            </h4>

            {loadingLanguages ? (
              <div className="py-4 text-center">
                <div className="inline-block animate-spin">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
              </div>
            ) : (
              <select
                value={selectedLanguage}
                onChange={e => onLanguageChange(e.target.value)}
                disabled={isLoadingDocuments}
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sortedLanguages.map(language => (
                  <option key={language.code} value={language.code}>
                    {getLanguageName(language.code)} ({language.document_count})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tag list - Takes remaining space and scrolls */}
        <div className="min-h-0 flex-1 border-t border-gray-700/50 px-4 pb-4">
          <div className="flex h-full flex-wrap gap-1 overflow-y-auto pr-2 pt-4">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-400">No tags available</p>
            ) : (
              tags.map(tag => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <label
                    key={tag.id}
                    className="cursor-pointer"
                    title={`${tag.name} (${tag.usage_count} documents)`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onTagToggle(tag.name)}
                      className="pointer-events-none absolute -left-full -top-full opacity-0"
                      tabIndex={-1}
                    />
                    <span
                      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] transition-all duration-150 ${
                        isSelected
                          ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-gray-800/40 text-gray-400 hover:bg-gray-700/40'
                      }`}
                    >
                      {tag.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Delete confirmation modal (admin only) */}
      {isAdmin && showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Delete Selected Tags?
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete {selectedTags.length} tag
              {selectedTags.length !== 1 ? 's' : ''}? This will remove the tag
              {selectedTags.length !== 1 ? 's' : ''} from all documents.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTags}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
