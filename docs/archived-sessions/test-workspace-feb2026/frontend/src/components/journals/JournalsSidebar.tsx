'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useJournalsData } from '@/stores/journals/useJournalsData';
import { useJournalsUI } from '@/stores/journals/useJournalsUI';
import { useJournalsSearch } from '@/stores/journals/useJournalsSearch';
import { useJournalsSelection } from '@/stores/journals/useJournalsSelection';
import { useJournalsHistory } from '@/stores/journals/useJournalsHistory';
import type { JournalNode, JournalCategory } from '@/stores/journals/types';
import { JournalCategorySection } from './JournalCategorySection';
import { TreeNode } from './TreeNode';
import { CreateJournalModal } from './CreateJournalModal';
import { logger } from '@/lib/utils/logger';

interface JournalsSidebarProps {
  journals: JournalNode[];
  categories: JournalCategory[];
  currentSlug?: string;
}

/**
 * JournalsSidebar - Left sidebar with categories, search, and tree navigation
 * Journals are organized into collapsible categories
 */
export function JournalsSidebar({ journals, categories, currentSlug }: JournalsSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateCategoryInput, setShowCreateCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Use split stores
  const {
    journals: storeJournals,
    categories: storeCategories,
    setJournals,
    setCategories,
    addJournal,
    addCategory,
    updateCategory,
    removeCategory,
    updateJournalCategory,
    updateJournalTitle,
    removeJournals,
    getJournalsByCategory,
  } = useJournalsData();

  const { setSelectedJournal } = useJournalsUI();

  const {
    searchQuery,
    searchResults,
    isSearching,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
  } = useJournalsSearch();

  const {
    selectedJournalsForDeletion,
    selectedCategoriesForDeletion,
    clearSelections,
    clearCategorySelections,
    selectAll,
    selectOnly,
    toggleJournalSelection,
  } = useJournalsSelection();

  const { pushHistory, undo, redo, canUndo, canRedo } = useJournalsHistory();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // NOTE: Store initialization moved to JournalsLayout.tsx to prevent
  // overwriting store state on every render. This was causing journals
  // to revert to their original categories after being moved.
  // See: 2026-02-13 bug fix

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data.user?.role) {
            setUserRole(data.user.role);
          }
        }
      } catch (error) {
        logger.error('Failed to fetch user role:', error);
      }
    };
    fetchUserRole();
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setSearchQuery('');
        setSearchResults(null);
        return;
      }

      setIsSearching(true);
      setSearchQuery(query);

      try {
        const response = await fetch(`/api/journals/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
          setSearchResults(data.data);
        } else {
          logger.error('Search failed:', data.error);
        }
      } catch (error) {
        logger.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchQuery, setSearchResults, setIsSearching]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleSelectNode = useCallback(
    (node: JournalNode) => {
      setSelectedJournal(node.id);
      const params = new URLSearchParams(searchParams.toString());
      params.set('selected', node.slug);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      selectOnly(node.id);
    },
    [router, pathname, searchParams, setSelectedJournal, selectOnly]
  );

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleJournalCreated = useCallback(
    (journal: JournalNode) => {
      addJournal(journal);
      setSelectedJournal(journal.id);
      const params = new URLSearchParams(searchParams.toString());
      params.set('selected', journal.slug);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [addJournal, router, pathname, searchParams, setSelectedJournal]
  );

  const handleRename = useCallback(
    async (node: JournalNode, newTitle: string) => {
      try {
        // Capture history before rename
        pushHistory({
          type: 'rename',
          timestamp: Date.now(),
          journalIds: [node.id],
          previousState: {
            [node.id]: {
              title: node.title,
            },
          },
          newState: {
            [node.id]: {
              title: newTitle,
            },
          },
        });

        const response = await fetch(`/api/journals/${node.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!response.ok) {
          throw new Error('Failed to rename journal');
        }

        updateJournalTitle(node.id, newTitle);
      } catch (error) {
        logger.error('Error renaming journal:', error);
        alert('Failed to rename journal. Please try again.');
      }
    },
    [updateJournalTitle, pushHistory]
  );

  // Category management
  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    setIsCreatingCategory(true);
    try {
      const response = await fetch('/api/journals/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create category');
      }

      addCategory(data.data);
      setNewCategoryName('');
      setShowCreateCategoryInput(false);
    } catch (error) {
      logger.error('Error creating category:', error);
      alert(error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  }, [newCategoryName, addCategory]);

  const handleRenameCategory = useCallback(
    async (category: JournalCategory, newName: string) => {
      try {
        const response = await fetch(`/api/journals/categories/${category.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to rename category');
        }

        updateCategory(category.id, { name: newName });
      } catch (error) {
        logger.error('Error renaming category:', error);
        alert(error instanceof Error ? error.message : 'Failed to rename category');
      }
    },
    [updateCategory]
  );

  const handleDeleteCategory = useCallback(
    async (category: JournalCategory) => {
      if (
        !confirm(`Delete category "${category.name}"? Journals will be moved to Uncategorized.`)
      ) {
        return;
      }

      try {
        const response = await fetch(`/api/journals/categories/${category.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to delete category');
        }

        // Move journals in this category to uncategorized (locally)
        const uncategorizedCategory = storeCategories.find(c => c.name === 'Uncategorized');
        if (uncategorizedCategory) {
          const journalsInCategory = getJournalsByCategory(category.id);
          journalsInCategory.forEach(j => {
            updateJournalCategory(j.id, uncategorizedCategory.id);
          });
        }

        removeCategory(category.id);
      } catch (error) {
        logger.error('Error deleting category:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete category');
      }
    },
    [removeCategory, getJournalsByCategory, updateJournalCategory]
  );

  const handleMoveJournal = useCallback(
    async (journal: JournalNode, categoryId: string) => {
      try {
        // Capture history before move
        pushHistory({
          type: 'move',
          timestamp: Date.now(),
          journalIds: [journal.id],
          previousState: {
            [journal.id]: {
              categoryId: journal.journal_category_id,
            },
          },
          newState: {
            [journal.id]: {
              categoryId: categoryId,
            },
          },
        });

        const response = await fetch(`/api/journals/${journal.slug}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to move journal');
        }

        updateJournalCategory(journal.id, categoryId);
      } catch (error) {
        logger.error('Error moving journal:', error);
        alert(error instanceof Error ? error.message : 'Failed to move journal');
      }
    },
    [updateJournalCategory, pushHistory]
  );

  const handleDeleteConfirm = useCallback(async () => {
    const journalIds = Array.from(selectedJournalsForDeletion);
    const categoryIds = Array.from(selectedCategoriesForDeletion);

    if (journalIds.length === 0 && categoryIds.length === 0) return;

    try {
      // Delete journals if any (soft delete)
      if (journalIds.length > 0) {
        // Capture history before delete
        const previousState: Record<number, { isDeleted?: boolean }> = {};
        const newState: Record<number, { isDeleted?: boolean }> = {};

        journalIds.forEach(id => {
          const journal = storeJournals.find(j => j.id === id);
          if (journal) {
            previousState[id] = { isDeleted: journal.is_deleted };
            newState[id] = { isDeleted: true };
          }
        });

        pushHistory({
          type: 'delete',
          timestamp: Date.now(),
          journalIds,
          previousState,
          newState,
        });

        const response = await fetch('/api/journals/bulk-delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ journalIds, permanent: false }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to delete journals';
          try {
            const errorData = await response.json();
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch {
            errorMessage = `Failed to delete journals: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        // Mark as deleted in local state (don't remove)
        setJournals(
          storeJournals.map(j => (journalIds.includes(j.id) ? { ...j, is_deleted: true } : j))
        );
      }

      // Delete categories if any
      if (categoryIds.length > 0) {
        const uncategorizedCategory = storeCategories.find(c => c.name === 'Uncategorized');

        for (const categoryId of categoryIds) {
          try {
            const response = await fetch(`/api/journals/categories/${categoryId}`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error?.message || 'Failed to delete category');
            }

            // Move journals in this category to uncategorized
            if (uncategorizedCategory) {
              const journalsInCategory = getJournalsByCategory(categoryId);
              journalsInCategory.forEach(j => {
                updateJournalCategory(j.id, uncategorizedCategory.id);
              });
            }

            removeCategory(categoryId);
          } catch (error) {
            logger.error('Error deleting category:', error);
            throw error;
          }
        }
      }

      clearSelections();
      clearCategorySelections();
      setShowDeleteConfirm(false);

      const selectedSlug = searchParams.get('selected');
      const deletedJournal = storeJournals.find(
        j => journalIds.includes(j.id) && j.slug === selectedSlug
      );

      if (deletedJournal) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('selected');
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.replace(newUrl, { scroll: false });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete items';
      logger.error('Error deleting items:', error);
      alert(errorMessage);
    }
  }, [
    selectedJournalsForDeletion,
    selectedCategoriesForDeletion,
    removeJournals,
    removeCategory,
    clearSelections,
    clearCategorySelections,
    searchParams,
    pathname,
    router,
    storeJournals,
    getJournalsByCategory,
    updateJournalCategory,
    pushHistory,
    setJournals,
  ]);

  // Restore deleted journal
  const handleRestore = useCallback(
    async (journal: JournalNode) => {
      try {
        // Capture history before restore
        pushHistory({
          type: 'restore',
          timestamp: Date.now(),
          journalIds: [journal.id],
          previousState: {
            [journal.id]: {
              isDeleted: journal.is_deleted,
            },
          },
          newState: {
            [journal.id]: {
              isDeleted: false,
            },
          },
        });

        const response = await fetch('/api/journals/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ journalIds: [journal.id] }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to restore journal');
        }

        // Update journal in local state
        setJournals(
          storeJournals.map(j => (j.id === journal.id ? { ...j, is_deleted: false } : j))
        );
      } catch (error) {
        logger.error('Error restoring journal:', error);
        alert(error instanceof Error ? error.message : 'Failed to restore journal');
      }
    },
    [storeJournals, setJournals, pushHistory]
  );

  // Permanently delete journal (admin only, already deleted)
  const handlePermanentDelete = useCallback(
    async (journal: JournalNode) => {
      if (!journal.is_deleted) {
        alert('Journal must be deleted first before permanent deletion');
        return;
      }

      if (!confirm(`Permanently delete "${journal.title}"? This cannot be undone.`)) {
        return;
      }

      try {
        const response = await fetch('/api/journals/bulk-delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journalIds: [journal.id],
            permanent: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to permanently delete journal');
        }

        // Remove from local state completely
        removeJournals([journal.id]);
      } catch (error) {
        logger.error('Error permanently deleting journal:', error);
        alert(error instanceof Error ? error.message : 'Failed to permanently delete journal');
      }
    },
    [removeJournals]
  );

  // Get categories from store (will update after initial load)
  const displayCategories = storeCategories.length > 0 ? storeCategories : categories;

  // When searching, show flat list of results
  const isSearchMode = searchQuery && searchResults;
  const displayedJournals = searchResults?.pages || storeJournals;

  // Debug logging for render decision
  useEffect(() => {
    logger.info('[Sidebar] Render state', {
      storeCategoriesCount: storeCategories.length,
      propsCategoriesCount: categories.length,
      displayCategoriesCount: displayCategories.length,
      journalsCount: storeJournals.length,
      displayedJournalsCount: displayedJournals.length,
      isSearchMode,
      willShowNoJournalsMessage: displayCategories.length === 0,
    });
  }, [
    storeCategories.length,
    categories.length,
    displayCategories.length,
    storeJournals.length,
    displayedJournals.length,
    isSearchMode,
  ]);

  const journalSelectionCount = selectedJournalsForDeletion.size;
  const categorySelectionCount = selectedCategoriesForDeletion.size;
  const totalSelectionCount = journalSelectionCount + categorySelectionCount;

  // Handle keyboard shortcuts (Delete, Escape, Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key
      if (e.key === 'Delete' && totalSelectionCount > 0) {
        e.preventDefault();
        setShowDeleteConfirm(true);
      }

      // Escape key
      if (e.key === 'Escape' && totalSelectionCount > 0) {
        e.preventDefault();
        clearSelections();
        clearCategorySelections();
      }

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          const updatedJournals = undo(storeJournals);
          setJournals(updatedJournals);
        }
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Y, Cmd+Shift+Z on Mac)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        if (canRedo()) {
          const updatedJournals = redo(storeJournals);
          setJournals(updatedJournals);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSelectionCount, clearSelections, clearCategorySelections, undo, redo, canUndo, canRedo]);

  // Auto-scroll when dragging near edges + enable mousewheel scrolling during drag
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let animationFrameId: number | null = null;
    let isDragging = false;
    let mouseY = 0;

    const SCROLL_ZONE = 50; // Distance from edge to trigger scroll (pixels)
    const SCROLL_SPEED = 5; // Scroll speed (pixels per frame)

    const handleDragOver = (e: DragEvent) => {
      isDragging = true;
      mouseY = e.clientY;
    };

    const handleDragEnd = () => {
      isDragging = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const handleDrop = () => {
      isDragging = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    // Enable mousewheel scrolling during drag
    const handleWheel = (e: WheelEvent) => {
      if (isDragging) {
        // Allow normal wheel scrolling even during drag
        e.stopPropagation();
      }
    };

    const autoScroll = () => {
      if (!isDragging || !scrollContainer) {
        animationFrameId = null;
        return;
      }

      const rect = scrollContainer.getBoundingClientRect();
      const relativeY = mouseY - rect.top;

      // Scroll up if near top
      if (relativeY < SCROLL_ZONE && scrollContainer.scrollTop > 0) {
        const intensity = 1 - relativeY / SCROLL_ZONE; // More intense closer to edge
        scrollContainer.scrollTop -= SCROLL_SPEED * intensity;
      }
      // Scroll down if near bottom
      else if (relativeY > rect.height - SCROLL_ZONE) {
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (scrollContainer.scrollTop < maxScroll) {
          const intensity = 1 - (rect.height - relativeY) / SCROLL_ZONE;
          scrollContainer.scrollTop += SCROLL_SPEED * intensity;
        }
      }

      animationFrameId = requestAnimationFrame(autoScroll);
    };

    // Start auto-scroll loop on drag
    const handleDragStart = () => {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(autoScroll);
      }
    };

    scrollContainer.addEventListener('dragover', handleDragOver);
    scrollContainer.addEventListener('dragend', handleDragEnd);
    scrollContainer.addEventListener('drop', handleDrop);
    scrollContainer.addEventListener('wheel', handleWheel);
    window.addEventListener('dragstart', handleDragStart);

    return () => {
      scrollContainer.removeEventListener('dragover', handleDragOver);
      scrollContainer.removeEventListener('dragend', handleDragEnd);
      scrollContainer.removeEventListener('drop', handleDrop);
      scrollContainer.removeEventListener('wheel', handleWheel);
      window.removeEventListener('dragstart', handleDragStart);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col border-r border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Journals</h2>
          <div className="flex items-center gap-2">
            {totalSelectionCount > 0 && (
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400">
                {totalSelectionCount} selected
              </span>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={localSearchQuery}
            onChange={handleSearchChange}
            placeholder="Search journals..."
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 pl-9 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500/50 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Search Status */}
        {isSearching && (
          <div className="mt-2 flex items-center text-xs text-gray-400">
            <svg
              className="mr-1 h-3 w-3 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Searching...
          </div>
        )}

        {searchQuery && searchResults && (
          <div className="mt-2 text-xs text-gray-400">
            Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Journal Tree / Categories */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2">
        {isSearchMode ? (
          // Search results - flat list
          displayedJournals.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No journals found</div>
          ) : (
            <div className="space-y-0.5">
              {displayedJournals.map((journal: JournalNode) => (
                <TreeNode
                  key={journal.id}
                  node={journal}
                  onSelect={handleSelectNode}
                  onRename={handleRename}
                  userRole={userRole}
                />
              ))}
            </div>
          )
        ) : displayCategories.length === 0 ? (
          // No categories - check if journals exist
          storeJournals.length > 0 ? (
            // Fallback: Show flat list when categories unavailable
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                All Journals
              </div>
              <div className="space-y-0.5">
                {storeJournals.map((journal: JournalNode) => (
                  <TreeNode
                    key={journal.id}
                    node={journal}
                    onSelect={handleSelectNode}
                    onRename={handleRename}
                    userRole={userRole}
                  />
                ))}
              </div>
              {/* Add Category Button - Available even in fallback mode */}
              <div className="mt-2">
                {showCreateCategoryInput ? (
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCategoryName.trim()) {
                        handleCreateCategory();
                      }
                      if (e.key === 'Escape') {
                        setShowCreateCategoryInput(false);
                        setNewCategoryName('');
                      }
                    }}
                    placeholder="Category name..."
                    className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                    disabled={isCreatingCategory}
                  />
                ) : (
                  <button
                    onClick={() => setShowCreateCategoryInput(true)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                    title="Add category"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Add Category</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Only show empty state if BOTH categories AND journals are empty
            <div className="py-8 text-center text-sm text-gray-500">
              No journals yet. Create your first journal!
            </div>
          )
        ) : (
          // Categories with journals
          <div className="space-y-1">
            {displayCategories.map(category => (
              <JournalCategorySection
                key={category.id}
                category={category}
                journals={getJournalsByCategory(category.id)}
                currentSlug={currentSlug}
                onSelectJournal={handleSelectNode}
                onRenameJournal={handleRename}
                onRenameCategory={handleRenameCategory}
                onDeleteCategory={handleDeleteCategory}
                onMoveJournal={handleMoveJournal}
                userRole={userRole}
              />
            ))}
            {/* Add Category Button or Input */}
            <div className="mt-2">
              {showCreateCategoryInput ? (
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCategoryName.trim()) {
                      handleCreateCategory();
                    }
                    if (e.key === 'Escape') {
                      setShowCreateCategoryInput(false);
                      setNewCategoryName('');
                    }
                  }}
                  placeholder="Category name..."
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                  disabled={isCreatingCategory}
                />
              ) : (
                <button
                  onClick={() => setShowCreateCategoryInput(true)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                  title="Add category"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>Add Category</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Journal Button */}
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={handleCreateNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-700 px-4 py-3 text-sm font-medium text-gray-400 transition-all hover:border-gray-600 hover:bg-gray-800/50 hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Journal
        </button>
      </div>

      {/* Create Journal Modal */}
      <CreateJournalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleJournalCreated}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-100">Delete Items</h3>
            <p className="mb-6 text-sm text-gray-300">
              Are you sure you want to delete {journalSelectionCount} journal
              {journalSelectionCount !== 1 ? 's' : ''}
              {categorySelectionCount > 0 &&
                ` and ${categorySelectionCount} categor${categorySelectionCount !== 1 ? 'ies' : 'y'}`}
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
