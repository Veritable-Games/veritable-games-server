'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import debounce from 'lodash.debounce';
import { ContentSanitizer } from '@/lib/content/sanitization';
import { LibraryListView } from '@/components/library/LibraryListView';
import { TagFilterSidebar } from '@/components/library/TagFilterSidebar';
import { DocumentCard } from '@/components/library/DocumentCard';
import {
  DocumentCardSkeleton,
  DocumentListRowSkeleton,
} from '@/components/library/DocumentCardSkeleton';
import { ScrollPositionIndicator } from '@/components/library/ScrollPositionIndicator';
import { LibraryMouseFollowingCounter } from '@/components/library/LibraryMouseFollowingCounter';
import { SourceBadge } from '@/components/documents/SourceBadge';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { useVirtualizedDocuments } from '@/hooks/useVirtualizedDocuments';
import { useLibraryPreferences } from '@/hooks/useLibraryPreferences';
import { useDocumentSelectionStore } from '@/lib/stores/documentSelectionStore';
import { fetchJSON } from '@/lib/utils/csrf';
import { formatPublicationDate } from '@/lib/utils/date-formatter';
import type { LibraryViewMode, LibraryDocumentWithMetadata } from '@/lib/library/types';
import type { UnifiedDocument } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

interface Tag {
  id: number;
  name: string;
  usage_count: number;
}

type LibrarySortBy =
  | 'title'
  | 'date'
  | 'author'
  | 'type'
  | 'category'
  | 'source-type'
  | 'tags'
  | 'publication_date'
  | 'page_count';

interface BulkActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Extended Virtuoso handle with internal scroll element access
interface VirtuosoHandleExtended extends VirtuosoHandle {
  scrollElement?: HTMLElement;
  _scrollElement?: HTMLElement;
}

interface LibraryPageClientProps {
  initialDocuments: UnifiedDocument[];
  tags: Tag[];
  user: { id: number; username: string; role: string } | null;
  stats?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Wrapper component that manages state and renders both toolbar and content
export function LibraryPageClient({
  initialDocuments,
  tags: initialTags,
  user,
  stats,
}: LibraryPageClientProps) {
  // Library preferences (scroll position + sort)
  const libraryPreferences = useLibraryPreferences();

  // Track initial mount to skip filter effect on first render
  const isInitialMount = useRef(true);

  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedSource, setSelectedSource] = useState<'all' | 'library' | 'anarchist'>('all');
  const [sortBy, setSortBy] = useState<LibrarySortBy>(
    (libraryPreferences.sortBy as LibrarySortBy) || 'title'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(libraryPreferences.sortOrder);
  const [viewMode, setViewMode] = useState<LibraryViewMode>('grid');
  const [tags, setTags] = useState<Tag[]>(initialTags);

  // Infinite scroll state
  const [documents, setDocuments] = useState<UnifiedDocument[]>(initialDocuments);
  const [currentPage, setCurrentPage] = useState(stats?.page || 1);
  const [totalDocuments, setTotalDocuments] = useState(stats?.total || initialDocuments.length);
  const [hasMore, setHasMore] = useState(stats?.hasMore || false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem('library-view-mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  // Sync sort preferences from localStorage on client-side mount
  // This handles the hydration mismatch where SSR uses defaults but localStorage has saved values
  useEffect(() => {
    if (libraryPreferences.sortBy && libraryPreferences.sortBy !== sortBy) {
      setSortBy(libraryPreferences.sortBy as LibrarySortBy);
    }
    if (libraryPreferences.sortOrder && libraryPreferences.sortOrder !== sortOrder) {
      setSortOrder(libraryPreferences.sortOrder);
    }
    // Only run once on mount to sync from localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('library-view-mode', viewMode);
  }, [viewMode]);

  // Save sort preferences to localStorage when they change
  useEffect(() => {
    libraryPreferences.saveSortPreferences(sortBy, sortOrder);
  }, [sortBy, sortOrder, libraryPreferences.saveSortPreferences]);

  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const handleClearFilters = () => {
    setSelectedTags([]);
  };

  const handleRefreshTags = async (language?: string) => {
    try {
      const response = await fetch(`/api/library/tags`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tags) {
          setTags(data.tags);
        }
      }
    } catch (error) {
      logger.error('Failed to refresh tags:', error);
    }
  };

  // Refetch documents when language or source filter changes
  useEffect(() => {
    // Skip on initial mount - server already provided data
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    logger.info(
      '[LibraryPageClient] Filters changed - Language:',
      selectedLanguage,
      'Source:',
      selectedSource
    );

    // Clear scroll position (but keep sort preferences)
    libraryPreferences.clearScrollPosition();

    // Reset pagination state to refetch with new filters
    setDocuments([]);
    setCurrentPage(0);
    setHasMore(true);

    const params = new URLSearchParams({
      page: '1',
      limit: '200',
    });

    if (searchQuery) params.append('query', searchQuery);
    if (selectedTags.length > 0) {
      selectedTags.forEach(tag => params.append('tags', tag));
    }
    if (selectedLanguage) {
      params.append('language', selectedLanguage);
    }
    if (selectedSource) {
      params.append('source', selectedSource);
    }

    fetch(`/api/documents?${params}`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setDocuments(result.data.documents || []);
          setCurrentPage(result.data.pagination?.page || 1);
          setTotalDocuments(result.data.pagination?.total || 0);
          setHasMore(result.data.pagination?.has_more ?? false);
        }
      })
      .catch(error => {
        logger.error('[LibraryPageClient] Failed to fetch filtered documents:', error);
      });
  }, [
    selectedLanguage,
    selectedSource,
    searchQuery,
    selectedTags,
    setDocuments,
    setCurrentPage,
    setHasMore,
    setTotalDocuments,
    libraryPreferences.clearScrollPosition,
  ]);

  // Refresh tags and translate selected tags when language changes
  useEffect(() => {
    logger.info('[LibraryPageClient] Refreshing tags for language:', selectedLanguage || 'all');

    // Refresh tag list with language filter
    handleRefreshTags(selectedLanguage || undefined);

    // If we have selected tags and a language is selected, translate them
    if (selectedTags.length > 0 && selectedLanguage) {
      logger.info('[LibraryPageClient] Translating selected tags to:', selectedLanguage);

      fetch('/api/tags/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagNames: selectedTags,
          targetLanguage: selectedLanguage,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.translations) {
            // Replace selected tags with their translations
            const translated = selectedTags.map(
              tag => data.translations[tag] || tag // Keep original if no translation
            );

            // Filter out duplicates
            const uniqueTranslated = Array.from(new Set(translated));

            if (JSON.stringify(uniqueTranslated) !== JSON.stringify(selectedTags)) {
              logger.info('[LibraryPageClient] Updated selected tags:', uniqueTranslated);
              setSelectedTags(uniqueTranslated);
            }
          }
        })
        .catch(error => {
          logger.error('[LibraryPageClient] Failed to translate tags:', error);
        });
    }
  }, [selectedLanguage]);

  // Reset pagination when search query changes (triggers server-side search)
  const handleSearchChange = useCallback(
    (newQuery: string) => {
      logger.info('[LibraryPageClient] Search query changed:', newQuery);
      setSearchQuery(newQuery);

      // Clear scroll position (but keep sort preferences)
      libraryPreferences.clearScrollPosition();

      // Reset pagination state to refetch with new search
      setDocuments([]);
      setCurrentPage(0); // Will be set to 1 by loadMoreDocuments
      setHasMore(true);

      // Trigger refetch with new search query
      // Note: loadMoreDocuments will use the updated searchQuery from closure
      setTimeout(() => {
        const params = new URLSearchParams({
          page: '1',
          limit: '200',
        });

        if (newQuery) params.append('query', newQuery);
        if (selectedTags.length > 0) {
          selectedTags.forEach(tag => params.append('tags', tag));
        }
        if (selectedLanguage) {
          params.append('language', selectedLanguage);
        }
        if (selectedSource) {
          params.append('source', selectedSource);
        }

        fetch(`/api/documents?${params}`)
          .then(res => res.json())
          .then(result => {
            if (result.success && result.data) {
              setDocuments(result.data.documents || []);
              setCurrentPage(result.data.pagination?.page || 1);
              setTotalDocuments(result.data.pagination?.total || 0);
              setHasMore(result.data.pagination?.has_more ?? false);
            }
          })
          .catch(error => {
            logger.error('[LibraryPageClient] Failed to fetch search results:', error);
          });
      }, 0);
    },
    [
      selectedTags,
      selectedLanguage,
      selectedSource,
      setDocuments,
      setCurrentPage,
      setHasMore,
      setTotalDocuments,
      setSearchQuery,
      libraryPreferences.clearScrollPosition,
    ]
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <LibraryContent
        documents={documents}
        setDocuments={setDocuments}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalDocuments={totalDocuments}
        setTotalDocuments={setTotalDocuments}
        hasMore={hasMore}
        setHasMore={setHasMore}
        isLoadingMore={isLoadingMore}
        setIsLoadingMore={setIsLoadingMore}
        isLoadingAll={isLoadingAll}
        setIsLoadingAll={setIsLoadingAll}
        tags={tags}
        user={user}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchChange}
        selectedTags={selectedTags}
        selectedLanguage={selectedLanguage}
        selectedSource={selectedSource}
        onTagToggle={handleTagToggle}
        onLanguageChange={setSelectedLanguage}
        onSourceChange={setSelectedSource}
        onClearFilters={handleClearFilters}
        onRefreshTags={handleRefreshTags}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        viewMode={viewMode}
        setViewMode={setViewMode}
        libraryPreferences={libraryPreferences}
      />
    </div>
  );
}

// Content component with document grid
function LibraryContent({
  documents,
  setDocuments,
  currentPage,
  setCurrentPage,
  totalDocuments,
  setTotalDocuments,
  hasMore,
  setHasMore,
  isLoadingMore,
  setIsLoadingMore,
  isLoadingAll,
  setIsLoadingAll,
  tags,
  user,
  searchQuery,
  setSearchQuery,
  selectedTags,
  selectedLanguage,
  selectedSource,
  onTagToggle,
  onLanguageChange,
  onSourceChange,
  onClearFilters,
  onRefreshTags,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  libraryPreferences,
}: {
  documents: UnifiedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<UnifiedDocument[]>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalDocuments: number;
  setTotalDocuments: React.Dispatch<React.SetStateAction<number>>;
  hasMore: boolean;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingMore: boolean;
  setIsLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingAll: boolean;
  setIsLoadingAll: React.Dispatch<React.SetStateAction<boolean>>;
  tags: Tag[];
  user: { id: number; username: string; role: string } | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  selectedLanguage: string;
  selectedSource: 'all' | 'library' | 'anarchist';
  onTagToggle: (tagName: string) => void;
  onLanguageChange: (language: string) => void;
  onSourceChange: (source: 'all' | 'library' | 'anarchist') => void;
  onClearFilters: () => void;
  onRefreshTags: () => void;
  sortBy: LibrarySortBy;
  setSortBy: (sort: LibrarySortBy) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  viewMode: LibraryViewMode;
  setViewMode: (mode: LibraryViewMode) => void;
  libraryPreferences: ReturnType<typeof useLibraryPreferences>;
}) {
  // Responsive view mode - force grid on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const effectiveViewMode = isMobile ? 'grid' : viewMode;

  // Document selection for multi-select and bulk operations
  const selectAllDocuments = useDocumentSelectionStore(state => state.selectAllDocuments);
  const clearSelection = useDocumentSelectionStore(state => state.clearSelection);
  const selectedDocumentIds = useDocumentSelectionStore(state => state.selectedDocumentIds);
  const selectionCount = useDocumentSelectionStore(state => state.selectionCount);

  // Bulk delete modal state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Virtuoso ref for jump-to functionality
  const virtuosoRef = useRef<VirtuosoHandleExtended | null>(null);

  // Track visible range for position indicator
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  // Virtualized documents hook - replaces old array accumulation
  const {
    getDocument,
    totalCount,
    loadedCount,
    fetchRangeIfNeeded,
    isLoadingRange,
    clearCache,
    resetWithNewFilters,
    isIndexLoaded,
  } = useVirtualizedDocuments({
    initialDocuments: documents,
    initialTotal: totalDocuments,
    searchQuery,
    selectedTags,
    selectedLanguage,
    selectedSource,
    sortBy,
    sortOrder,
  });

  // Build array of loaded documents ON-DEMAND only when needed for selection operations
  // NOT rebuilt on every loadedCount change - avoids 27k index iteration on every fetch
  const getLoadedDocuments = useCallback((): UnifiedDocument[] => {
    const docs: UnifiedDocument[] = [];
    for (let i = 0; i < totalCount; i++) {
      const doc = getDocument(i);
      if (doc) {
        docs.push(doc);
      }
    }
    return docs;
  }, [totalCount, getDocument]);

  // Load all remaining documents (for Ctrl+A) - fetch entire visible range
  const loadAllRemainingDocuments = useCallback(async () => {
    logger.info('[LibraryContent] Loading all documents for selection...');
    // Fetch the entire range
    await fetchRangeIfNeeded(0, totalCount - 1);
    logger.info('[LibraryContent] All documents loaded for selection');
  }, [totalCount, fetchRangeIfNeeded]);

  // Scroll position management for non-virtualized views
  const { ref: scrollContainerRef, restorePosition } = useScrollPosition({
    key: 'library-scroll-position',
    enabled: viewMode === 'list', // Only restore position for list view
  });

  // Note: Scroll restoration not needed for grid view (Virtuoso handles it)

  // Handle column sorting for list view
  const handleSort = (column: string) => {
    const sortColumn = column as LibrarySortBy;
    if (sortBy === sortColumn) {
      // Toggle order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column: default to ascending
      setSortBy(sortColumn);
      setSortOrder('asc');
    }
  };

  // Get selected documents from cache (only loaded ones)
  const getSelectedDocuments = useCallback((): UnifiedDocument[] => {
    const selected: UnifiedDocument[] = [];
    for (let i = 0; i < totalCount; i++) {
      const doc = getDocument(i);
      if (doc && selectedDocumentIds.has(String(doc.id))) {
        selected.push(doc);
      }
    }
    return selected;
  }, [totalCount, getDocument, selectedDocumentIds]);

  // Handle visibility toggle for selected documents
  const handleToggleVisibility = async () => {
    if (selectedDocumentIds.size === 0) {
      logger.debug('[LibraryPageClient] No documents selected for visibility toggle');
      return;
    }

    // Check permissions - only admin/moderator can toggle visibility
    if (user?.role !== 'admin' && user?.role !== 'moderator') {
      logger.warn('[LibraryPageClient] Visibility toggle attempted by non-admin/moderator');
      return;
    }

    const selectedDocs = getSelectedDocuments();
    logger.debug(`[LibraryPageClient] Toggling visibility for ${selectedDocs.length} documents`, {
      documents: selectedDocs.map(d => ({
        id: d.id,
        title: d.title,
        source: d.source,
        current_is_public: d.is_public,
      })),
      timestamp: new Date().toISOString(),
    });

    // Determine target visibility state
    // If all selected are public, make them private
    // If any are private, make all public
    const allPublic = selectedDocs.every(d => d.is_public === true);
    const targetIsPublic = !allPublic;

    logger.debug('[LibraryPageClient] Visibility toggle decision', {
      allPublic,
      targetIsPublic,
      selectedCount: selectedDocs.length,
    });

    // Group by source (library vs anarchist)
    const libraryIds: number[] = [];
    const anarchistIds: number[] = [];

    selectedDocs.forEach(doc => {
      const numericId = typeof doc.id === 'string' ? parseInt(doc.id, 10) : doc.id;
      if (doc.source === 'library') {
        libraryIds.push(numericId);
      } else {
        anarchistIds.push(numericId);
      }
    });

    logger.debug('[LibraryPageClient] Grouped documents by source', {
      libraryIds,
      anarchistIds,
    });

    try {
      // Optimistic update - update UI immediately
      setDocuments(prev =>
        prev.map(d =>
          selectedDocumentIds.has(String(d.id)) ? { ...d, is_public: targetIsPublic } : d
        )
      );

      logger.debug('[LibraryPageClient] Optimistic UI update completed');

      // Send API requests (parallel if both sources)
      const promises: Promise<any>[] = [];

      if (libraryIds.length > 0) {
        logger.debug('[LibraryPageClient] Sending library visibility update', {
          count: libraryIds.length,
          isPublic: targetIsPublic,
        });
        promises.push(
          fetchJSON('/api/library/documents/batch-update-visibility', {
            method: 'POST',
            body: {
              documentIds: libraryIds,
              isPublic: targetIsPublic,
              source: 'library',
            },
          })
        );
      }

      if (anarchistIds.length > 0) {
        logger.debug('[LibraryPageClient] Sending anarchist visibility update', {
          count: anarchistIds.length,
          isPublic: targetIsPublic,
        });
        promises.push(
          fetchJSON('/api/library/documents/batch-update-visibility', {
            method: 'POST',
            body: {
              documentIds: anarchistIds,
              isPublic: targetIsPublic,
              source: 'anarchist',
            },
          })
        );
      }

      const results = (await Promise.all(promises)) as BulkActionResult[];

      // Check for failures
      const failures = results.filter((r: BulkActionResult) => !r.success);
      if (failures.length > 0) {
        logger.error('[LibraryPageClient] Failed to update some documents:', failures);
        // Rollback optimistic update by reverting the is_public values
        setDocuments(prev =>
          prev.map(d =>
            selectedDocumentIds.has(String(d.id))
              ? { ...d, is_public: !targetIsPublic } // Revert to original
              : d
          )
        );
        alert('Failed to update some documents. Please try again.');
      } else {
        logger.debug('[LibraryPageClient] Visibility toggle successful, clearing selection');
        // Success - clear selection
        clearSelection();
      }
    } catch (error) {
      logger.error('[LibraryPageClient] Error toggling visibility:', error);
      // Rollback optimistic update
      setDocuments(prev =>
        prev.map(d =>
          selectedDocumentIds.has(String(d.id))
            ? { ...d, is_public: !targetIsPublic } // Revert to original
            : d
        )
      );
      alert('Error toggling visibility. Please try again.');
    }
  };

  // Handle bulk delete confirmation and execution
  const handleConfirmBulkDelete = async () => {
    logger.debug('[LibraryPageClient] Bulk delete initiated');
    setBulkDeleting(true);

    const docsToDelete = getSelectedDocuments();
    logger.debug(`[LibraryPageClient] Deleting ${docsToDelete.length} document(s)`, {
      documents: docsToDelete.map(d => ({
        id: d.id,
        title: d.title,
        source: d.source,
        slug: d.slug,
      })),
      timestamp: new Date().toISOString(),
    });

    let successCount = 0;
    let failureCount = 0;

    for (const doc of docsToDelete) {
      try {
        // Route to appropriate delete endpoint based on source
        const endpoint =
          doc.source === 'anarchist'
            ? `/api/documents/anarchist/${encodeURIComponent(doc.slug)}`
            : `/api/library/documents/${encodeURIComponent(doc.slug)}`;

        logger.debug(`[LibraryPageClient] Deleting document: "${doc.title}"`, {
          endpoint,
          source: doc.source,
          slug: doc.slug,
        });

        const result = await fetchJSON(endpoint, {
          method: 'DELETE',
        });

        logger.debug(`[LibraryPageClient] Delete successful for "${doc.title}"`, { result });
        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[LibraryPageClient] Failed to delete "${doc.title}":`, {
          error: errorMsg,
          fullError: error,
          timestamp: new Date().toISOString(),
        });
        failureCount++;
      }
    }

    logger.debug('[LibraryPageClient] Bulk delete completed', {
      successCount,
      failureCount,
      totalAttempted: docsToDelete.length,
    });

    setBulkDeleting(false);
    setShowBulkDeleteModal(false);
    clearSelection();

    // Show result message
    if (successCount > 0 && failureCount === 0) {
      logger.info('[LibraryPageClient] All documents deleted successfully, reloading page');
      // Reload to refresh list
      window.location.reload();
    } else if (successCount > 0) {
      const msg = `Deleted ${successCount} document(s), but ${failureCount} failed`;
      logger.warn('[LibraryPageClient] Partial delete with failures:', msg);
      alert(msg);
      window.location.reload();
    } else {
      logger.error('[LibraryPageClient] All documents failed to delete');
      alert(`Failed to delete all documents`);
    }
  };

  // Keyboard event handler for selection shortcuts and Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: Clear selection
      if (e.key === 'Escape') {
        logger.debug('[LibraryPageClient] Escape key pressed', {
          selectedCount: selectionCount(),
          timestamp: new Date().toISOString(),
        });

        if (selectionCount() > 0) {
          logger.debug('[LibraryPageClient] Clearing selection');
          clearSelection();
          logger.debug('[LibraryPageClient] Selection cleared');
        }
      }

      // Ctrl+A or Cmd+A: Load all documents (if needed) then select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();

        // Check if we need to load more documents first
        const needsLoading = loadedCount < totalCount;
        if (needsLoading) {
          logger.debug(
            '[LibraryPageClient] Ctrl+A pressed - loading all remaining documents first',
            { loaded: loadedCount, total: totalCount }
          );
          loadAllRemainingDocuments().then(() => {
            // After loading completes, select all documents
            setTimeout(() => {
              logger.debug('[LibraryPageClient] Selecting all documents after load', {
                totalCount,
                timestamp: new Date().toISOString(),
              });
              selectAllDocuments(getLoadedDocuments());
            }, 100);
          });
        } else {
          logger.debug('[LibraryPageClient] Ctrl+A pressed - selecting all documents', {
            loadedCount,
            totalCount,
            timestamp: new Date().toISOString(),
          });
          selectAllDocuments(getLoadedDocuments());
        }
      }

      // Delete key - open bulk delete modal for selected documents
      if (e.key === 'Delete') {
        logger.debug('[LibraryPageClient] Delete key pressed', {
          userRole: user?.role,
          isAdmin: user?.role === 'admin',
          timestamp: new Date().toISOString(),
        });

        if (user?.role !== 'admin') {
          logger.warn('[LibraryPageClient] Delete key pressed but user is not admin');
          return;
        }

        const selected = getSelectedDocuments();
        logger.debug(`[LibraryPageClient] Selected documents: ${selected.length}`, {
          selectedIds: Array.from(selectedDocumentIds),
          selectedDocs: selected.map(d => ({ id: d.id, title: d.title, source: d.source })),
        });

        if (selected.length > 0) {
          logger.debug(
            '[LibraryPageClient] Opening bulk delete modal for',
            selected.length,
            'documents'
          );
          e.preventDefault();
          e.stopPropagation();
          setShowBulkDeleteModal(true);
        } else {
          logger.debug('[LibraryPageClient] Delete key pressed but no documents selected');
        }
      }

      // Tab key - toggle visibility for selected documents (admin/moderator only)
      if (e.key === 'Tab') {
        logger.debug('[LibraryPageClient] Tab key pressed', {
          userRole: user?.role,
          isAdminOrModerator: user?.role === 'admin' || user?.role === 'moderator',
          selectedCount: selectionCount(),
          timestamp: new Date().toISOString(),
        });

        // Only admin/moderator can toggle visibility
        if (user?.role !== 'admin' && user?.role !== 'moderator') {
          logger.warn('[LibraryPageClient] Tab key pressed but user is not admin/moderator');
          return;
        }

        // Only toggle if documents are selected
        if (selectionCount() > 0) {
          e.preventDefault();
          e.stopPropagation();
          logger.debug('[LibraryPageClient] Toggling visibility for selected documents');
          handleToggleVisibility();
        } else {
          logger.debug('[LibraryPageClient] Tab key pressed but no documents selected');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    logger.debug('[LibraryPageClient] Keyboard shortcuts listener registered');
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      logger.debug('[LibraryPageClient] Keyboard shortcuts listener unregistered');
    };
  }, [
    user,
    loadedCount,
    totalCount,
    selectedDocumentIds,
    selectAllDocuments,
    clearSelection,
    selectionCount,
    handleToggleVisibility,
    loadAllRemainingDocuments,
    getSelectedDocuments,
    getLoadedDocuments,
  ]);

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-hidden md:flex-row md:gap-3">
      {/* Filter Sidebar - Above content on mobile, left side on desktop */}
      <div className="flex w-full flex-col gap-3 md:w-56 md:flex-shrink-0 md:gap-3 md:overflow-y-auto md:overflow-x-hidden">
        {/* Combined Tag & Language Filter */}
        <div className="flex-1 md:px-0">
          <TagFilterSidebar
            tags={tags}
            selectedTags={selectedTags}
            onTagToggle={onTagToggle}
            onClearFilters={onClearFilters}
            user={user}
            onRefreshTags={onRefreshTags}
            selectedLanguage={selectedLanguage}
            onLanguageChange={onLanguageChange}
            isLoadingDocuments={isLoadingMore || isLoadingAll}
          />
        </div>
      </div>

      {/* Main Content Area - Documents */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar - only spans document area */}
        <div className="mb-3 flex-shrink-0">
          <LibraryToolbar
            user={user}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedSource={selectedSource}
            onSourceChange={onSourceChange}
            sortBy={sortBy}
            setSortBy={setSortBy}
            documentCount={totalCount}
            totalCount={totalCount}
            viewMode={viewMode}
            setViewMode={setViewMode}
            virtuosoRef={virtuosoRef}
          />
        </div>

        {/* Documents Grid or List */}
        <div className="flex-1 overflow-hidden">
          {totalCount === 0 ? (
            <div className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-8 text-center">
              <p className="text-gray-400">No documents match your filters</p>
            </div>
          ) : effectiveViewMode === 'grid' ? (
            /* Grid View with Virtual Scrolling */
            <VirtuosoGridView
              totalCount={totalCount}
              getDocument={getDocument}
              fetchRangeIfNeeded={fetchRangeIfNeeded}
              isLoadingRange={isLoadingRange}
              virtuosoRef={virtuosoRef}
              setVisibleRange={setVisibleRange}
              searchQuery={searchQuery}
              selectedTags={selectedTags}
              viewMode={effectiveViewMode}
              scrollPosition={libraryPreferences.scrollPosition}
              saveScrollPosition={libraryPreferences.saveScrollPosition}
              user={user}
            />
          ) : (
            /* List View with Virtual Scrolling */
            <VirtuosoListView
              totalCount={totalCount}
              getDocument={getDocument}
              fetchRangeIfNeeded={fetchRangeIfNeeded}
              isLoadingRange={isLoadingRange}
              virtuosoRef={virtuosoRef}
              setVisibleRange={setVisibleRange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchQuery={searchQuery}
              selectedTags={selectedTags}
              viewMode={effectiveViewMode}
              scrollPosition={libraryPreferences.scrollPosition}
              saveScrollPosition={libraryPreferences.saveScrollPosition}
            />
          )}
        </div>
      </div>

      {/* Scroll Position Indicator */}
      <ScrollPositionIndicator
        visibleRange={visibleRange}
        totalCount={totalCount}
        viewMode={effectiveViewMode}
      />

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-800">
            <div className="p-6">
              <h2 className="mb-2 text-lg font-semibold text-white">Delete Documents?</h2>
              <p className="mb-4 text-gray-300">
                You are about to delete {getSelectedDocuments().length} document(s). This action
                cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1 rounded border border-gray-600 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBulkDelete}
                  disabled={bulkDeleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkDeleting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="opacity-25"
                        />
                        <path
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Counter */}
      <LibraryMouseFollowingCounter documentCount={selectionCount()} />
    </div>
  );
}

/**
 * VirtuosoGridView - Renders documents in a 2-column grid using virtual scrolling
 * Uses totalCount and rangeChanged for true virtualized scrolling
 * Documents load on-demand based on visible range
 */
function VirtuosoGridView({
  totalCount,
  getDocument,
  fetchRangeIfNeeded,
  isLoadingRange,
  virtuosoRef,
  setVisibleRange,
  searchQuery,
  selectedTags,
  viewMode,
  scrollPosition,
  saveScrollPosition,
  user,
}: {
  totalCount: number;
  getDocument: (index: number) => UnifiedDocument | undefined;
  fetchRangeIfNeeded: (start: number, end: number) => Promise<void>;
  isLoadingRange: boolean;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  setVisibleRange: React.Dispatch<React.SetStateAction<{ start: number; end: number }>>;
  searchQuery: string;
  selectedTags: string[];
  viewMode: 'grid' | 'list';
  scrollPosition: { viewMode: string; index: number; offset?: number } | null;
  saveScrollPosition: (viewMode: 'grid' | 'list', index: number, offset?: number) => void;
  user: { id: number; username: string; role: string } | null;
}) {
  // Calculate grid row count (2 docs per row)
  const gridRowCount = Math.ceil(totalCount / 2);

  // Track if this is the initial range change (to skip debounce for faster initial load)
  const isInitialRangeChange = useRef(true);

  // Reset initial range flag when filters change
  useEffect(() => {
    isInitialRangeChange.current = true;
  }, [searchQuery, selectedTags]);

  // Create debounced fetch function to prevent excessive requests during rapid scrolling
  const debouncedFetchRange = useMemo(() => {
    const debounced = debounce((start: number, end: number) => {
      fetchRangeIfNeeded(start, end);
    }, 300);

    // Return both function and cancel method
    return {
      fetch: debounced,
      cancel: () => debounced.cancel(),
    };
  }, [fetchRangeIfNeeded]);

  // Cancel pending debounced fetches when component unmounts or debounce function changes
  useEffect(() => {
    return () => {
      if (debouncedFetchRange?.cancel) {
        debouncedFetchRange.cancel();
      }
    };
  }, [debouncedFetchRange]);

  // Restore scroll position on mount (if saved for grid view)
  useEffect(() => {
    if (
      scrollPosition &&
      scrollPosition.viewMode === 'grid' &&
      virtuosoRef.current &&
      totalCount > 0
    ) {
      // Clamp index to valid range
      const targetIndex = Math.min(scrollPosition.index, gridRowCount - 1);

      // Delay scroll restoration to ensure Virtuoso is fully rendered
      requestAnimationFrame(() => {
        // Step 1: Scroll to index (snaps to row top)
        virtuosoRef.current?.scrollToIndex({
          index: targetIndex,
          align: 'start',
          behavior: 'auto',
        });

        // Step 2: Apply pixel offset for sub-pixel positioning
        if (scrollPosition.offset && scrollPosition.offset !== 0) {
          requestAnimationFrame(() => {
            if (virtuosoRef.current) {
              const extendedRef = virtuosoRef.current as VirtuosoHandleExtended;
              const scrollElement = extendedRef.scrollElement || extendedRef._scrollElement;
              if (scrollElement) {
                scrollElement.scrollBy({ top: scrollPosition.offset, behavior: 'auto' });
              }
            }
          });
        }
      });
    }
  }, [scrollPosition, totalCount, gridRowCount, virtuosoRef]);

  // Handle range changes - fetch documents as user scrolls
  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      // Calculate document indices from row indices
      const docStart = range.startIndex * 2;
      const docEnd = Math.min((range.endIndex + 1) * 2 - 1, totalCount - 1);

      // Update visible range for position indicator (immediate, no debounce)
      setVisibleRange({ start: range.startIndex, end: range.endIndex });

      // Save scroll position with pixel offset (debounced via saveScrollPosition hook)
      // Access scroll container from the Virtuoso ref's DOM element
      if (virtuosoRef.current) {
        const extended = virtuosoRef.current as VirtuosoHandleExtended;
        const scrollElement = extended.scrollElement || extended._scrollElement;
        if (scrollElement && typeof scrollElement.scrollTop === 'number') {
          // Grid rows are 252px tall (fixedItemHeight)
          const offset = scrollElement.scrollTop - range.startIndex * 252;
          saveScrollPosition('grid', range.startIndex, offset);
        }
      }

      // Fetch with overscan buffer for smooth scrolling (reduced from 20 to 10)
      const overscan = 10;
      const fetchStart = Math.max(0, docStart - overscan);
      const fetchEnd = Math.min(totalCount - 1, docEnd + overscan);

      // Skip debounce on initial range change for faster initial load
      if (isInitialRangeChange.current) {
        isInitialRangeChange.current = false;
        fetchRangeIfNeeded(fetchStart, fetchEnd); // Immediate fetch
      } else {
        debouncedFetchRange.fetch(fetchStart, fetchEnd); // Debounced (300ms)
      }
    },
    [
      totalCount,
      debouncedFetchRange,
      fetchRangeIfNeeded,
      setVisibleRange,
      saveScrollPosition,
      virtuosoRef,
    ]
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      totalCount={gridRowCount}
      fixedItemHeight={252}
      itemContent={rowIndex => {
        const docIndex1 = rowIndex * 2;
        const docIndex2 = rowIndex * 2 + 1;

        const doc1 = docIndex1 < totalCount ? getDocument(docIndex1) : undefined;
        const doc2 = docIndex2 < totalCount ? getDocument(docIndex2) : undefined;

        return (
          <div className="mb-3 grid grid-cols-1 gap-3 pr-4 md:grid-cols-2">
            {docIndex1 < totalCount &&
              (doc1 ? (
                <DocumentCard key={`${doc1.source}-${doc1.id}`} doc={doc1} user={user} />
              ) : (
                <DocumentCardSkeleton />
              ))}
            {docIndex2 < totalCount &&
              (doc2 ? (
                <DocumentCard key={`${doc2.source}-${doc2.id}`} doc={doc2} user={user} />
              ) : (
                <DocumentCardSkeleton />
              ))}
          </div>
        );
      }}
      style={{ height: '100%' }}
      overscan={{ main: 2000, reverse: 2000 }}
      rangeChanged={handleRangeChanged}
      components={{
        Footer: () =>
          isLoadingRange ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-sm text-gray-400">Loading documents...</div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="text-sm text-gray-500">
                {searchQuery || selectedTags.length > 0
                  ? `Found ${totalCount.toLocaleString()} matching documents`
                  : `All ${totalCount.toLocaleString()} documents`}
              </div>
            </div>
          ),
      }}
    />
  );
}

/**
 * VirtuosoListView - Renders documents in a table using virtual scrolling
 * Uses totalCount and rangeChanged for true virtualized scrolling
 * Documents load on-demand based on visible range
 * Header remains sticky and non-virtualized
 */
function VirtuosoListView({
  totalCount,
  getDocument,
  fetchRangeIfNeeded,
  isLoadingRange,
  virtuosoRef,
  setVisibleRange,
  sortBy,
  sortOrder,
  onSort,
  searchQuery,
  selectedTags,
  viewMode,
  scrollPosition,
  saveScrollPosition,
}: {
  totalCount: number;
  getDocument: (index: number) => UnifiedDocument | undefined;
  fetchRangeIfNeeded: (start: number, end: number) => Promise<void>;
  isLoadingRange: boolean;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  setVisibleRange: React.Dispatch<React.SetStateAction<{ start: number; end: number }>>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  searchQuery: string;
  selectedTags: string[];
  viewMode: 'grid' | 'list';
  scrollPosition: { viewMode: string; index: number; offset?: number } | null;
  saveScrollPosition: (viewMode: 'grid' | 'list', index: number, offset?: number) => void;
}) {
  const router = useRouter();

  // Track if this is the initial range change (to skip debounce for faster initial load)
  const isInitialRangeChange = useRef(true);

  // Reset initial range flag when filters change
  useEffect(() => {
    isInitialRangeChange.current = true;
  }, [searchQuery, selectedTags]);

  // Create debounced fetch function to prevent excessive requests during rapid scrolling
  const debouncedFetchRange = useMemo(() => {
    const debounced = debounce((start: number, end: number) => {
      fetchRangeIfNeeded(start, end);
    }, 300);

    // Return both function and cancel method
    return {
      fetch: debounced,
      cancel: () => debounced.cancel(),
    };
  }, [fetchRangeIfNeeded]);

  // Cancel pending debounced fetches when component unmounts or debounce function changes
  useEffect(() => {
    return () => {
      if (debouncedFetchRange?.cancel) {
        debouncedFetchRange.cancel();
      }
    };
  }, [debouncedFetchRange]);

  // Restore scroll position on mount (if saved for list view)
  useEffect(() => {
    if (
      scrollPosition &&
      scrollPosition.viewMode === 'list' &&
      virtuosoRef.current &&
      totalCount > 0
    ) {
      // Clamp index to valid range
      const targetIndex = Math.min(scrollPosition.index, totalCount - 1);

      // Delay scroll restoration to ensure Virtuoso is fully rendered
      requestAnimationFrame(() => {
        // Step 1: Scroll to index (snaps to item top)
        virtuosoRef.current?.scrollToIndex({
          index: targetIndex,
          align: 'start',
          behavior: 'auto',
        });

        // Step 2: Apply pixel offset for sub-pixel positioning
        if (scrollPosition.offset && scrollPosition.offset !== 0) {
          requestAnimationFrame(() => {
            if (virtuosoRef.current) {
              const extendedRef = virtuosoRef.current as VirtuosoHandleExtended;
              const scrollElement = extendedRef.scrollElement || extendedRef._scrollElement;
              if (scrollElement) {
                scrollElement.scrollBy({ top: scrollPosition.offset, behavior: 'auto' });
              }
            }
          });
        }
      });
    }
  }, [scrollPosition, totalCount, virtuosoRef]);

  // Handle range changes - fetch documents as user scrolls
  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      // Update visible range for position indicator (immediate, no debounce)
      setVisibleRange({ start: range.startIndex, end: range.endIndex });

      // Save scroll position with pixel offset (debounced via saveScrollPosition hook)
      // Access scroll container from the Virtuoso ref's DOM element
      if (virtuosoRef.current) {
        const extended = virtuosoRef.current as VirtuosoHandleExtended;
        const scrollElement = extended.scrollElement || extended._scrollElement;
        if (scrollElement && typeof scrollElement.scrollTop === 'number') {
          // List items are 36px tall (fixedItemHeight)
          const offset = scrollElement.scrollTop - range.startIndex * 36;
          saveScrollPosition('list', range.startIndex, offset);
        }
      }

      // Fetch with overscan buffer for smooth scrolling (reduced from 20 to 10)
      const overscan = 10;
      const fetchStart = Math.max(0, range.startIndex - overscan);
      const fetchEnd = Math.min(totalCount - 1, range.endIndex + overscan);

      // Skip debounce on initial range change for faster initial load
      if (isInitialRangeChange.current) {
        isInitialRangeChange.current = false;
        fetchRangeIfNeeded(fetchStart, fetchEnd); // Immediate fetch
      } else {
        debouncedFetchRange.fetch(fetchStart, fetchEnd); // Debounced (300ms)
      }
    },
    [
      totalCount,
      debouncedFetchRange,
      fetchRangeIfNeeded,
      setVisibleRange,
      saveScrollPosition,
      virtuosoRef,
    ]
  );

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return null;
    }

    return sortOrder === 'asc' ? (
      <svg
        className="ml-1 h-3 w-3 text-blue-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg
        className="ml-1 h-3 w-3 text-blue-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900/70"
      role="table"
      aria-label="Library documents"
    >
      {/* Static Header - NOT virtualized, always visible */}
      <div
        className="sticky top-0 z-10 flex-shrink-0 border-b border-gray-700 bg-gray-800/30"
        role="rowgroup"
      >
        <div className="grid grid-cols-12 gap-2 px-3 py-1 pr-4 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          <button
            onClick={() => onSort('title')}
            className="col-span-5 flex cursor-pointer items-center text-left transition-colors hover:text-gray-300"
            role="columnheader"
            aria-sort={
              sortBy === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            aria-label="Sort by title"
          >
            Title
            {getSortIcon('title')}
          </button>
          <button
            onClick={() => onSort('author')}
            className="col-span-3 flex cursor-pointer items-center text-left transition-colors hover:text-gray-300"
            role="columnheader"
            aria-sort={
              sortBy === 'author' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            aria-label="Sort by author"
          >
            Author
            {getSortIcon('author')}
          </button>
          <button
            onClick={() => onSort('publication_date')}
            className="col-span-1 flex cursor-pointer items-center justify-center transition-colors hover:text-gray-300"
            role="columnheader"
            aria-sort={
              sortBy === 'publication_date'
                ? sortOrder === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            aria-label="Sort by publication date"
          >
            Year
            {getSortIcon('publication_date')}
          </button>
          <div className="col-span-3 flex items-center text-left normal-case" role="columnheader">
            tags
          </div>
        </div>
      </div>

      {/* Virtuoso Body - handles scrolling */}
      {totalCount === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-gray-400">
          <p>No documents match your filters</p>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          totalCount={totalCount}
          fixedItemHeight={36}
          itemContent={index => {
            const doc = getDocument(index);

            if (!doc) {
              return <DocumentListRowSkeleton />;
            }

            return (
              <div
                key={`${doc.source}-${doc.id}`}
                onClick={() => router.push(`/library/${doc.slug}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/library/${doc.slug}`);
                  }
                }}
                className="grid h-[36px] max-h-[36px] min-h-[36px] cursor-pointer grid-cols-12 gap-2 border-b border-gray-700/50 px-3 py-1.5 pr-4 transition-colors hover:bg-gray-800/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                role="row"
                tabIndex={0}
                aria-label={`Document: ${doc.title}`}
              >
                {/* Title Column */}
                <div className="col-span-5 flex min-w-0 items-center">
                  <span className="truncate text-xs text-white" title={doc.title}>
                    {doc.title}
                  </span>
                </div>

                {/* Author Column */}
                <div className="col-span-3 flex min-w-0 items-center">
                  <span className="truncate text-xs text-gray-300" title={doc.author || 'Unknown'}>
                    {doc.author || '—'}
                  </span>
                </div>

                {/* Publication Year Column */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-xs text-gray-400">
                    {formatPublicationDate(doc.publication_date, 'year')}
                  </span>
                </div>

                {/* Tags Column */}
                <div className="col-span-3 flex min-w-0 items-center">
                  <div className="flex max-h-8 flex-wrap gap-1 overflow-hidden">
                    {doc.tags && doc.tags.length > 0 ? (
                      <>
                        {doc.tags.slice(0, 5).map(tag => (
                          <span
                            key={tag.id}
                            className="whitespace-nowrap rounded bg-blue-900/30 px-1 py-0.5 text-[10px] leading-tight text-blue-300"
                            title={tag.name}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {doc.tags.length > 5 && (
                          <span
                            className="whitespace-nowrap rounded bg-gray-700/40 px-1 py-0.5 text-[10px] leading-tight text-gray-400"
                            title={`${doc.tags.length - 5} more tags`}
                          >
                            +{doc.tags.length - 5}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
          style={{ height: '100%' }}
          overscan={{ main: 2000, reverse: 2000 }}
          rangeChanged={handleRangeChanged}
          components={{
            Footer: () =>
              isLoadingRange ? (
                <div className="flex items-center justify-center border-t border-gray-700/50 py-4">
                  <div className="text-sm text-gray-400">Loading documents...</div>
                </div>
              ) : (
                <div className="flex items-center justify-center border-t border-gray-700/50 py-4">
                  <div className="text-sm text-gray-500">
                    {searchQuery || selectedTags.length > 0
                      ? `Found ${totalCount.toLocaleString()} matching documents`
                      : `All ${totalCount.toLocaleString()} documents`}
                  </div>
                </div>
              ),
          }}
        />
      )}
    </div>
  );
}

// Toolbar component with search and sort controls
export function LibraryToolbar({
  user,
  searchQuery,
  setSearchQuery,
  selectedSource,
  onSourceChange,
  sortBy,
  setSortBy,
  documentCount,
  totalCount,
  viewMode,
  setViewMode,
  virtuosoRef,
}: {
  user: { id: number; username: string; role: string } | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedSource: 'all' | 'library' | 'anarchist';
  onSourceChange: (source: 'all' | 'library' | 'anarchist') => void;
  sortBy: LibrarySortBy;
  setSortBy: (sort: LibrarySortBy) => void;
  documentCount: number;
  totalCount: number;
  viewMode: LibraryViewMode;
  setViewMode: (mode: LibraryViewMode) => void;
  virtuosoRef: React.RefObject<VirtuosoHandleExtended | null>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded border border-gray-700/40 bg-gray-900/20 px-1.5 py-1">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search library documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded border border-gray-600 bg-gray-800 pl-8 pr-3 text-sm text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
          />
          <svg
            className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* View switcher buttons - hidden on mobile */}
        <div className="hidden h-8 items-center overflow-hidden rounded border border-gray-600 md:flex">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center px-2 py-1 transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
            }`}
            aria-label="Grid view"
            title="Grid view"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center px-2 py-1 transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
            }`}
            aria-label="List view"
            title="List view"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as LibrarySortBy)}
          className="compact-select h-8 shrink-0 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white transition-colors focus:border-blue-500 md:px-3"
          title="Sort documents"
        >
          <option value="title">Title (A-Z)</option>
          <option value="author">Author (A-Z)</option>
          <option value="publication_date">Date (Newest)</option>
          <option value="page_count">Views (Most)</option>
          <option value="source-library-first">Library First</option>
          <option value="source-anarchist-first">Anarchist First</option>
        </select>

        {user && (
          <Link
            href="/library/create"
            className="flex h-8 shrink-0 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
          >
            Create
          </Link>
        )}
      </div>
    </div>
  );
}
