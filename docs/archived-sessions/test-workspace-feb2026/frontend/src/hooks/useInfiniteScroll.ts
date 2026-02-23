/**
 * Hook: useInfiniteScroll
 *
 * Manages infinite scroll state for documents
 * - Loads initial documents
 * - Appends new pages as user scrolls
 * - Handles loading and error states
 * - Preserves all loaded documents
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UnifiedDocument } from '@/lib/documents/types';
import { logger } from '@/lib/utils/logger';

interface UseInfiniteScrollOptions {
  initialDocuments: UnifiedDocument[];
  initialPage?: number;
  pageSize?: number;
  filters?: {
    query?: string;
    tags?: string[];
    language?: string;
    languages?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

interface UseInfiniteScrollResult {
  documents: UnifiedDocument[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useInfiniteScroll({
  initialDocuments,
  initialPage = 1,
  pageSize = 50, // FIX: Match initial page size (50 from library page) for consistency
  filters = {},
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const [documents, setDocuments] = useState<UnifiedDocument[]>(initialDocuments);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX: Track loaded document IDs to prevent duplicates
  const loadedIdsRef = useRef<Set<string | number>>(new Set());

  // Initialize loaded IDs from initial documents
  if (loadedIdsRef.current.size === 0 && initialDocuments.length > 0) {
    initialDocuments.forEach(doc => {
      loadedIdsRef.current.add(doc.id);
    });
  }

  // Use ref to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingRef.current || !hasMore) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    // Cancel previous request if any
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      // Build query params
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: pageSize.toString(),
      });

      if (filters.query) {
        params.append('query', filters.query);
      }
      if (filters.tags?.length) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters.languages?.length) {
        params.append('languages', filters.languages.join(','));
      } else if (filters.language) {
        params.append('language', filters.language);
      }
      if (filters.sortBy) {
        params.append('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.append('sortOrder', filters.sortOrder);
      }

      const response = await fetch(`/api/documents/unified?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      const { documents: newDocuments, pagination } = result.data;

      if (newDocuments && newDocuments.length > 0) {
        // FIX: Deduplicate new documents against already-loaded IDs
        const uniqueNewDocuments = newDocuments.filter((doc: UnifiedDocument) => {
          if (loadedIdsRef.current.has(doc.id)) {
            logger.warn('[useInfiniteScroll] Duplicate document detected:', {
              id: doc.id,
              title: doc.title,
              page,
            });
            return false; // Filter out duplicates
          }
          // Add to tracked IDs
          loadedIdsRef.current.add(doc.id);
          return true;
        });

        // FIX: Only append if there are unique documents after dedup
        if (uniqueNewDocuments.length > 0) {
          setDocuments(prev => [...prev, ...uniqueNewDocuments]);
        }

        setPage(pagination.page);

        // Check if there are more pages
        // FIX: ONLY rely on API pagination, not on deduplication results
        // The API's pagination.page and pagination.total_pages are the source of truth
        // Deduplication is a defensive mechanism, not a pagination control mechanism
        const hasMorePages = pagination.page < pagination.total_pages;
        setHasMore(hasMorePages);

        // Log deduplication stats (for diagnostic purposes)
        if (uniqueNewDocuments.length < newDocuments.length) {
          logger.info('[useInfiniteScroll] Removed duplicates:', {
            before: newDocuments.length,
            after: uniqueNewDocuments.length,
            duplicates: newDocuments.length - uniqueNewDocuments.length,
            page,
          });

          // Log warning if duplicate rate is very high (indicates server issue)
          const duplicateRate =
            (newDocuments.length - uniqueNewDocuments.length) / newDocuments.length;
          if (duplicateRate > 0.5) {
            logger.warn('[useInfiniteScroll] High duplicate rate detected:', {
              duplicateRate: `${(duplicateRate * 100).toFixed(1)}%`,
              message: 'Possible server pagination issue - more than 50% duplicates',
            });
          }
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      // Ignore abort errors (user scrolled away or filters changed)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      logger.error('[useInfiniteScroll] Load more error:', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, pageSize, hasMore, filters]);

  const reset = useCallback(() => {
    // Cancel ongoing request
    abortControllerRef.current?.abort();

    setDocuments(initialDocuments);
    setPage(initialPage);
    setHasMore(true);
    setLoading(false);
    setError(null);
    loadingRef.current = false;

    // FIX: Clear and reinitialize loaded IDs on reset
    loadedIdsRef.current.clear();
    initialDocuments.forEach(doc => {
      loadedIdsRef.current.add(doc.id);
    });
  }, [initialDocuments, initialPage]);

  // Reset when filters change significantly
  useEffect(() => {
    reset();
  }, [filters.query, filters.language, filters.sortBy, filters.sortOrder]);

  return {
    documents,
    page,
    hasMore,
    loading,
    error,
    loadMore,
    reset,
  };
}
