/**
 * useVirtualizedDocuments Hook
 *
 * Manages document caching and range-based fetching for virtual scrolling
 * Supports large datasets (20,000+ documents) with sparse loading
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UnifiedDocument } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

interface UseVirtualizedDocumentsProps {
  initialDocuments: UnifiedDocument[];
  initialTotal: number;
  searchQuery?: string;
  selectedTags?: string[];
  selectedLanguage?: string;
  selectedSource?: 'all' | 'library' | 'anarchist';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UseVirtualizedDocumentsReturn {
  // Document access
  getDocument: (index: number) => UnifiedDocument | undefined;
  totalCount: number;
  loadedCount: number;

  // Range fetching
  fetchRangeIfNeeded: (startIndex: number, endIndex: number) => Promise<void>;
  isLoadingRange: boolean;

  // Cache management
  clearCache: () => void;
  resetWithNewFilters: (total: number) => Promise<void>;

  // Utilities
  isIndexLoaded: (index: number) => boolean;
}

interface Range {
  start: number;
  end: number;
}

export function useVirtualizedDocuments({
  initialDocuments,
  initialTotal,
  searchQuery,
  selectedTags = [],
  selectedLanguage,
  selectedSource = 'all',
  sortBy,
  sortOrder,
}: UseVirtualizedDocumentsProps): UseVirtualizedDocumentsReturn {
  // Core state: Map-based cache instead of array accumulation
  const [documentCache, setDocumentCache] = useState<Map<number, UnifiedDocument>>(() => {
    const cache = new Map<number, UnifiedDocument>();
    initialDocuments.forEach((doc, index) => {
      cache.set(index, doc);
    });
    return cache;
  });

  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loadedRanges, setLoadedRanges] = useState<Set<string>>(
    new Set(['0-' + (initialDocuments.length - 1)])
  );
  const [isLoadingRange, setIsLoadingRange] = useState(false);

  // Track pending fetches to avoid duplicates
  const pendingFetches = useRef<Set<string>>(new Set());

  // Track abort controllers for ongoing requests
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  // Track initial mount to skip filter effect on first render
  // This prevents clearing SSR-provided documents when localStorage preferences differ
  const isInitialMount = useRef(true);

  // Track previous filter values for change detection
  const prevFiltersRef = useRef({
    searchQuery,
    selectedTags: JSON.stringify(selectedTags),
    selectedLanguage,
    selectedSource,
    sortBy,
    sortOrder,
  });

  // Maximum cache size (prevent memory bloat)
  // With 27k documents and 2000px overscan, we need a large cache
  // to avoid evicting visible documents during scrolling
  const MAX_CACHED_DOCUMENTS = 10000;

  /**
   * Sync cache when initialDocuments changes (for optimistic updates)
   * This allows visibility toggles and other state changes to reflect immediately
   */
  useEffect(() => {
    // Update existing documents in cache with new data from initialDocuments
    // This preserves the cache structure while reflecting parent state changes
    if (initialDocuments.length > 0) {
      setDocumentCache(prev => {
        const updated = new Map(prev);
        initialDocuments.forEach((doc, index) => {
          // Only update if document exists at this index in cache
          if (updated.has(index)) {
            updated.set(index, doc);
          }
        });
        return updated;
      });
    }
  }, [initialDocuments]);

  /**
   * Automatic reactivity: Reset cache when filters/sort changes
   * SKIP on initial mount to preserve SSR-provided documents
   */
  useEffect(() => {
    // Skip on initial mount - server already provided data
    // This prevents clearing the cache when localStorage preferences differ from SSR
    if (isInitialMount.current) {
      isInitialMount.current = false;

      // Still update ref for next comparison
      prevFiltersRef.current = {
        searchQuery,
        selectedTags: JSON.stringify(selectedTags),
        selectedLanguage,
        selectedSource,
        sortBy,
        sortOrder,
      };

      return;
    }

    const prev = prevFiltersRef.current;
    const filtersChanged =
      searchQuery !== prev.searchQuery ||
      JSON.stringify(selectedTags) !== prev.selectedTags ||
      selectedLanguage !== prev.selectedLanguage ||
      selectedSource !== prev.selectedSource ||
      sortBy !== prev.sortBy ||
      sortOrder !== prev.sortOrder;

    if (filtersChanged) {
      logger.info('[useVirtualizedDocuments] Filters/sort changed, resetting cache');

      // Abort all ongoing fetch requests
      abortControllers.current.forEach(controller => controller.abort());
      abortControllers.current.clear();

      // Clear existing cache
      setDocumentCache(new Map());
      setLoadedRanges(new Set());
      pendingFetches.current.clear();

      // Fetch new total count with updated filters
      const params = new URLSearchParams();
      if (selectedSource) params.append('source', selectedSource);
      if (searchQuery) params.append('query', searchQuery);
      if (selectedTags && selectedTags.length > 0) {
        selectedTags.forEach(tag => params.append('tags', tag));
      }
      if (selectedLanguage) params.append('language', selectedLanguage);

      // Fetch initial documents along with count
      const abortController = new AbortController();
      abortControllers.current.set('initial-fetch', abortController);

      fetch(`/api/documents/count?${params}`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            const newTotal = result.data.total;
            setTotalCount(newTotal);
            logger.info('[useVirtualizedDocuments] New total count:', newTotal);

            // Fetch initial documents (first 200) to populate cache immediately
            if (newTotal > 0) {
              const initialLimit = Math.min(200, newTotal);
              const fetchParams = new URLSearchParams(params);
              fetchParams.append('offset', '0');
              fetchParams.append('limit', String(initialLimit));
              if (sortBy) fetchParams.append('sort_by', sortBy);
              if (sortOrder) fetchParams.append('sort_order', sortOrder);

              logger.info(
                '[useVirtualizedDocuments] Fetching initial documents:',
                0,
                '-',
                initialLimit - 1
              );

              return fetch(`/api/documents?${fetchParams}`, { signal: abortController.signal })
                .then(res => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.json();
                })
                .then(docsResult => {
                  if (docsResult.success && docsResult.data) {
                    const newDocs = docsResult.data.documents || [];

                    // Populate cache with initial documents
                    const newCache = new Map<number, UnifiedDocument>();
                    newDocs.forEach((doc: UnifiedDocument, idx: number) => {
                      newCache.set(idx, doc);
                    });
                    setDocumentCache(newCache);

                    // Mark range as loaded
                    if (newDocs.length > 0) {
                      setLoadedRanges(new Set([`0-${newDocs.length - 1}`]));
                    }

                    logger.info('[useVirtualizedDocuments] Initial load complete:', {
                      total: newTotal,
                      loaded: newDocs.length,
                      range: `0-${newDocs.length - 1}`,
                    });
                  }
                });
            }
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            logger.error('[useVirtualizedDocuments] Failed to fetch initial data:', error);
          }
        })
        .finally(() => {
          abortControllers.current.delete('initial-fetch');
        });

      // Update ref to current values
      prevFiltersRef.current = {
        searchQuery,
        selectedTags: JSON.stringify(selectedTags),
        selectedLanguage,
        selectedSource,
        sortBy,
        sortOrder,
      };
    }
  }, [searchQuery, selectedTags, selectedLanguage, selectedSource, sortBy, sortOrder]);

  /**
   * Get document by index
   */
  const getDocument = useCallback(
    (index: number): UnifiedDocument | undefined => {
      return documentCache.get(index);
    },
    [documentCache]
  );

  /**
   * Check if an index is loaded
   */
  const isIndexLoaded = useCallback(
    (index: number): boolean => {
      return documentCache.has(index);
    },
    [documentCache]
  );

  /**
   * Generate range key for tracking
   */
  const rangeKey = (start: number, end: number): string => {
    return `${start}-${end}`;
  };

  /**
   * Check if a range is already loaded
   */
  const isRangeLoaded = useCallback(
    (start: number, end: number): boolean => {
      const key = rangeKey(start, end);
      return loadedRanges.has(key);
    },
    [loadedRanges]
  );

  /**
   * Find missing sub-ranges within a requested range
   */
  const findMissingRanges = useCallback(
    (start: number, end: number): Range[] => {
      const missing: Range[] = [];
      let currentStart: number | null = null;

      for (let i = start; i <= end; i++) {
        if (!documentCache.has(i)) {
          if (currentStart === null) {
            currentStart = i;
          }
        } else {
          if (currentStart !== null) {
            missing.push({ start: currentStart, end: i - 1 });
            currentStart = null;
          }
        }
      }

      // Handle trailing missing range
      if (currentStart !== null) {
        missing.push({ start: currentStart, end });
      }

      return missing;
    },
    [documentCache]
  );

  /**
   * Fetch a specific range of documents
   */
  const fetchRange = useCallback(
    async (start: number, end: number): Promise<void> => {
      const key = rangeKey(start, end);

      // Prevent duplicate fetches
      if (pendingFetches.current.has(key)) {
        return;
      }

      // Cancel any existing request for this range
      const existingController = abortControllers.current.get(key);
      if (existingController) {
        existingController.abort();
        abortControllers.current.delete(key);
      }

      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllers.current.set(key, controller);
      pendingFetches.current.add(key);

      try {
        const size = end - start + 1;
        const params = new URLSearchParams({
          offset: String(start),
          limit: String(size),
        });

        if (selectedSource) params.append('source', selectedSource);
        if (searchQuery) params.append('query', searchQuery);
        if (selectedTags.length > 0) {
          selectedTags.forEach(tag => params.append('tags', tag));
        }
        if (selectedLanguage) {
          params.append('language', selectedLanguage);
        }
        if (sortBy) {
          params.append('sort_by', sortBy);
        }
        if (sortOrder) {
          params.append('sort_order', sortOrder);
        }

        const response = await fetch(`/api/documents?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          const newDocs = result.data.documents || [];

          // Update cache immediately - no deferral to avoid stale closure issues
          // The fixedItemHeight in Virtuoso prevents layout shifts regardless of when we update
          setDocumentCache(prev => {
            const updated = new Map(prev);
            newDocs.forEach((doc: UnifiedDocument, idx: number) => {
              updated.set(start + idx, doc);
            });

            // Simple size-based eviction: only evict when significantly over limit
            // With 10k limit and 27k total, we can hold ~37% of documents
            // This is enough to avoid re-fetching during normal scrolling
            if (updated.size > MAX_CACHED_DOCUMENTS * 1.2) {
              // Evict oldest entries (lowest indices if scrolling down, highest if scrolling up)
              // For simplicity, just trim to MAX_CACHED_DOCUMENTS by removing furthest from current fetch
              const currentCenter = start + Math.floor(newDocs.length / 2);
              const entries = Array.from(updated.entries());
              entries.sort(
                (a, b) => Math.abs(a[0] - currentCenter) - Math.abs(b[0] - currentCenter)
              );

              // Keep closest MAX_CACHED_DOCUMENTS entries
              const toKeep = entries.slice(0, MAX_CACHED_DOCUMENTS);
              return new Map(toKeep);
            }

            return updated;
          });

          // Mark range as loaded
          setLoadedRanges(prev => new Set(prev).add(key));
        }
      } catch (error: any) {
        // Ignore abort errors (they're expected when user scrolls quickly)
        if (error.name !== 'AbortError') {
          logger.error('[useVirtualizedDocuments] Failed to fetch range:', { start, end, error });
        }
      } finally {
        pendingFetches.current.delete(key);
        abortControllers.current.delete(key);
      }
    },
    [searchQuery, selectedTags, selectedLanguage, selectedSource, sortBy, sortOrder, totalCount]
  );

  /**
   * Fetch range if not already loaded
   */
  const fetchRangeIfNeeded = useCallback(
    async (startIndex: number, endIndex: number): Promise<void> => {
      // Clamp to valid range
      const clampedStart = Math.max(0, startIndex);
      const clampedEnd = Math.min(totalCount - 1, endIndex);

      if (clampedStart > clampedEnd) {
        return;
      }

      // Find missing sub-ranges
      const missingRanges = findMissingRanges(clampedStart, clampedEnd);

      if (missingRanges.length === 0) {
        return; // All documents in range are already loaded
      }

      setIsLoadingRange(true);

      try {
        // Fetch all missing ranges in parallel
        await Promise.all(missingRanges.map(range => fetchRange(range.start, range.end)));
      } finally {
        setIsLoadingRange(false);
      }
    },
    [totalCount, findMissingRanges, fetchRange]
  );

  /**
   * Clear cache (for filter changes)
   */
  const clearCache = useCallback(() => {
    // Abort all ongoing fetch requests
    abortControllers.current.forEach(controller => controller.abort());
    abortControllers.current.clear();

    setDocumentCache(new Map());
    setLoadedRanges(new Set());
    pendingFetches.current.clear();
  }, []);

  /**
   * Reset with new filters and fetch new total count
   */
  const resetWithNewFilters = useCallback(
    async (newTotal: number): Promise<void> => {
      clearCache();
      setTotalCount(newTotal);

      // Fetch first page
      await fetchRange(0, 199);
    },
    [clearCache, fetchRange]
  );

  /**
   * Cleanup on unmount - abort all ongoing requests
   */
  useEffect(() => {
    return () => {
      logger.info('[useVirtualizedDocuments] Unmounting, cleanup abort controllers');
      abortControllers.current.forEach(controller => controller.abort());
      abortControllers.current.clear();
    };
  }, []);

  return {
    getDocument,
    totalCount,
    loadedCount: documentCache.size,
    fetchRangeIfNeeded,
    isLoadingRange,
    clearCache,
    resetWithNewFilters,
    isIndexLoaded,
  };
}
