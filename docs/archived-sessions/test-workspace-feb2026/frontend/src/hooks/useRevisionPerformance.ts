'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectVersioning } from '@/contexts/ProjectVersioningContext';
import { logger } from '@/lib/utils/logger';

/**
 * Chrome/Chromium Performance.memory API (non-standard)
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory;
}

// ==================== VIRTUALIZATION HOOK ====================

/**
 * Hook for virtualizing large lists of revisions
 * Optimizes rendering performance for projects with hundreds of revisions
 */
export function useRevisionVirtualization(
  itemHeight: number = 80,
  containerHeight: number = 600,
  overscan: number = 5
) {
  const { state, updateVisibleRange } = useProjectVersioning();
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const totalItems = state.filtered_revisions.length;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + visibleCount, totalItems);

    // Add overscan
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(totalItems, endIndex + overscan);

    return {
      start: overscanStart,
      end: overscanEnd,
      totalHeight: totalItems * itemHeight,
      offsetY: overscanStart * itemHeight,
    };
  }, [state.filtered_revisions.length, itemHeight, containerHeight, scrollTop, overscan]);

  // Update visible range in context
  useEffect(() => {
    updateVisibleRange(visibleRange.start, visibleRange.end);
  }, [visibleRange.start, visibleRange.end, updateVisibleRange]);

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Get visible items
  const visibleRevisions = useMemo(() => {
    return state.filtered_revisions.slice(visibleRange.start, visibleRange.end);
  }, [state.filtered_revisions, visibleRange.start, visibleRange.end]);

  // Scroll to revision
  const scrollToRevision = useCallback(
    (revisionId: number) => {
      const index = state.filtered_revisions.findIndex(r => r.id === revisionId);
      if (index === -1 || !containerRef.current) return;

      const scrollPosition = index * itemHeight;
      containerRef.current.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    },
    [state.filtered_revisions, itemHeight]
  );

  return {
    containerRef,
    visibleRevisions,
    visibleRange,
    scrollToRevision,
    isVirtualized: state.filtered_revisions.length > 100,
  };
}

// ==================== MEMOIZATION HOOKS ====================

/**
 * Hook for memoizing expensive revision computations
 */
export function useRevisionMemoization() {
  const { state } = useProjectVersioning();

  // Memoize revision statistics
  const revisionStats = useMemo(() => {
    const revisions = state.filtered_revisions;

    return {
      total: revisions.length,
      totalSize: revisions.reduce((sum, rev) => sum + rev.size, 0),
      averageSize: revisions.length
        ? revisions.reduce((sum, rev) => sum + rev.size, 0) / revisions.length
        : 0,
      sizeRange: revisions.length
        ? {
            min: Math.min(...revisions.map(r => r.size)),
            max: Math.max(...revisions.map(r => r.size)),
          }
        : { min: 0, max: 0 },
      authorStats: revisions.reduce(
        (stats, rev) => {
          if (!stats[rev.author_id]) {
            stats[rev.author_id] = {
              name: rev.author_name,
              count: 0,
              totalSize: 0,
            };
          }
          stats[rev.author_id]!.count++;
          stats[rev.author_id]!.totalSize += rev.size;
          return stats;
        },
        {} as Record<number, { name: string; count: number; totalSize: number }>
      ),
      dateRange: revisions.length
        ? {
            earliest: revisions.reduce((earliest, rev) =>
              new Date(rev.revision_timestamp) < new Date(earliest.revision_timestamp)
                ? rev
                : earliest
            ),
            latest: revisions.reduce((latest, rev) =>
              new Date(rev.revision_timestamp) > new Date(latest.revision_timestamp) ? rev : latest
            ),
          }
        : null,
    };
  }, [state.filtered_revisions]);

  // Memoize revision groupings
  const revisionGroupings = useMemo(() => {
    const revisions = state.filtered_revisions;

    return {
      byDate: revisions.reduce(
        (groups, revision) => {
          const date = new Date(revision.revision_timestamp).toDateString();
          if (!groups[date]) groups[date] = [];
          groups[date].push(revision);
          return groups;
        },
        {} as Record<string, typeof revisions>
      ),

      byAuthor: revisions.reduce(
        (groups, revision) => {
          const authorKey = `${revision.author_id}-${revision.author_name}`;
          if (!groups[authorKey]) groups[authorKey] = [];
          groups[authorKey].push(revision);
          return groups;
        },
        {} as Record<string, typeof revisions>
      ),

      bySizeRange: revisions.reduce(
        (groups, revision) => {
          const sizeRange =
            revision.size < 1024
              ? 'small'
              : revision.size < 10240
                ? 'medium'
                : revision.size < 102400
                  ? 'large'
                  : 'xlarge';

          if (!groups[sizeRange]) groups[sizeRange] = [];
          groups[sizeRange].push(revision);
          return groups;
        },
        {} as Record<string, typeof revisions>
      ),
    };
  }, [state.filtered_revisions]);

  // Memoize timeline data for visualization
  const timelineData = useMemo(() => {
    const revisions = state.filtered_revisions;
    if (!revisions.length) return [];

    // Group revisions by month for timeline visualization
    const monthlyGroups = revisions.reduce(
      (groups, revision) => {
        const date = new Date(revision.revision_timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!groups[monthKey]) {
          groups[monthKey] = {
            month: monthKey,
            revisions: [],
            totalChanges: 0,
            authors: new Set<number>(),
          };
        }

        groups[monthKey].revisions.push(revision);
        groups[monthKey].totalChanges += revision.size;
        groups[monthKey].authors.add(revision.author_id);

        return groups;
      },
      {} as Record<
        string,
        {
          month: string;
          revisions: typeof revisions;
          totalChanges: number;
          authors: Set<number>;
        }
      >
    );

    return Object.values(monthlyGroups)
      .map(group => ({
        ...group,
        authors: Array.from(group.authors),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [state.filtered_revisions]);

  return {
    stats: revisionStats,
    groupings: revisionGroupings,
    timelineData,
  };
}

// ==================== LAZY LOADING HOOK ====================

/**
 * Hook for implementing lazy loading of revision content
 */
export function useRevisionLazyLoading() {
  const [loadedRevisions, setLoadedRevisions] = useState<Set<number>>(new Set());
  const [loadingRevisions, setLoadingRevisions] = useState<Set<number>>(new Set());
  const contentCache = useRef<Map<number, string>>(new Map());

  const loadRevisionContent = useCallback(
    async (revisionId: number): Promise<string> => {
      // Check cache first
      if (contentCache.current.has(revisionId)) {
        return contentCache.current.get(revisionId)!;
      }

      // Check if already loading
      if (loadingRevisions.has(revisionId)) {
        // Wait for existing request
        return new Promise(resolve => {
          const checkLoaded = () => {
            if (contentCache.current.has(revisionId)) {
              resolve(contentCache.current.get(revisionId)!);
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
        });
      }

      setLoadingRevisions(prev => new Set([...prev, revisionId]));

      try {
        const response = await fetch(`/api/revisions/${revisionId}/content`);

        if (!response.ok) {
          throw new Error(`Failed to load revision content: ${response.status}`);
        }

        const data = await response.json();
        const content = data.content || '';

        // Cache the content
        contentCache.current.set(revisionId, content);
        setLoadedRevisions(prev => new Set([...prev, revisionId]));

        return content;
      } catch (error) {
        logger.error('Error loading revision content:', error);
        throw error;
      } finally {
        setLoadingRevisions(prev => {
          const newSet = new Set(prev);
          newSet.delete(revisionId);
          return newSet;
        });
      }
    },
    [loadingRevisions]
  );

  const preloadRevisionContent = useCallback(
    (revisionIds: number[]) => {
      revisionIds.forEach(id => {
        if (!contentCache.current.has(id) && !loadingRevisions.has(id)) {
          loadRevisionContent(id).catch(err =>
            logger.error('Failed to preload revision content', err)
          );
        }
      });
    },
    [loadRevisionContent, loadingRevisions]
  );

  const isRevisionLoaded = useCallback(
    (revisionId: number) => {
      return loadedRevisions.has(revisionId);
    },
    [loadedRevisions]
  );

  const isRevisionLoading = useCallback(
    (revisionId: number) => {
      return loadingRevisions.has(revisionId);
    },
    [loadingRevisions]
  );

  const getRevisionContent = useCallback((revisionId: number): string | null => {
    return contentCache.current.get(revisionId) || null;
  }, []);

  const clearCache = useCallback(() => {
    contentCache.current.clear();
    setLoadedRevisions(new Set());
    setLoadingRevisions(new Set());
  }, []);

  return {
    loadRevisionContent,
    preloadRevisionContent,
    isRevisionLoaded,
    isRevisionLoading,
    getRevisionContent,
    clearCache,
    cacheSize: contentCache.current.size,
  };
}

// ==================== DIFF OPTIMIZATION HOOK ====================

/**
 * Hook for optimizing diff calculations and rendering
 */
export function useDiffOptimization() {
  const [diffCache] = useState<Map<string, any>>(new Map());
  const workerRef = useRef<Worker | null>(null);

  // Initialize web worker for diff calculations
  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
      try {
        // Create worker for heavy diff computations
        const workerScript = `
          self.onmessage = function(e) {
            const { id, oldText, newText } = e.data;
            
            // Simple diff implementation (in practice, use a library like diff)
            const lines1 = oldText.split('\\n');
            const lines2 = newText.split('\\n');
            
            const changes = [];
            const maxLines = Math.max(lines1.length, lines2.length);
            
            for (let i = 0; i < maxLines; i++) {
              const line1 = lines1[i];
              const line2 = lines2[i];
              
              if (line1 !== line2) {
                if (line1 === undefined) {
                  changes.push({ type: 'added', line: i + 1, content: line2 });
                } else if (line2 === undefined) {
                  changes.push({ type: 'removed', line: i + 1, content: line1 });
                } else {
                  changes.push({ type: 'modified', line: i + 1, old: line1, new: line2 });
                }
              }
            }
            
            self.postMessage({ id, changes });
          };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        workerRef.current = new Worker(URL.createObjectURL(blob));
      } catch (error) {
        logger.warn('Failed to create diff worker:', error);
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const calculateDiff = useCallback(
    async (
      fromRevisionId: number,
      toRevisionId: number,
      oldContent: string,
      newContent: string
    ): Promise<any> => {
      const cacheKey = `${fromRevisionId}-${toRevisionId}`;

      // Check cache first
      if (diffCache.has(cacheKey)) {
        return diffCache.get(cacheKey);
      }

      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          // Fallback to main thread calculation
          const changes = calculateDiffSync(oldContent, newContent);
          diffCache.set(cacheKey, changes);
          resolve(changes);
          return;
        }

        const requestId = `diff-${Date.now()}-${Math.random()}`;

        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === requestId) {
            workerRef.current?.removeEventListener('message', handleMessage);
            const result = e.data.changes;
            diffCache.set(cacheKey, result);
            resolve(result);
          }
        };

        const handleError = (error: ErrorEvent) => {
          workerRef.current?.removeEventListener('error', handleError);
          reject(error);
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.addEventListener('error', handleError);

        workerRef.current.postMessage({
          id: requestId,
          oldText: oldContent,
          newText: newContent,
        });
      });
    },
    [diffCache]
  );

  const getDiffStats = useCallback((changes: any[]) => {
    return changes.reduce(
      (stats, change) => {
        switch (change.type) {
          case 'added':
            stats.additions++;
            break;
          case 'removed':
            stats.deletions++;
            break;
          case 'modified':
            stats.modifications++;
            break;
        }
        return stats;
      },
      { additions: 0, deletions: 0, modifications: 0 }
    );
  }, []);

  const clearDiffCache = useCallback(() => {
    diffCache.clear();
  }, [diffCache]);

  return {
    calculateDiff,
    getDiffStats,
    clearDiffCache,
    cacheSize: diffCache.size,
  };
}

// ==================== SEARCH OPTIMIZATION HOOK ====================

/**
 * Hook for optimizing search across revisions
 */
export function useRevisionSearch() {
  const [searchIndex, setSearchIndex] = useState<Map<string, number[]>>(new Map());
  const [indexing, setIndexing] = useState(false);
  const { state } = useProjectVersioning();

  // Build search index
  const buildSearchIndex = useCallback(async () => {
    setIndexing(true);

    try {
      const index = new Map<string, number[]>();

      // Index revision content, summaries, and authors
      state.revisions.forEach(revision => {
        const text = [revision.content, revision.summary, revision.author_name]
          .join(' ')
          .toLowerCase();

        // Simple word tokenization
        const words = text.match(/\w+/g) || [];

        words.forEach(word => {
          if (word.length >= 2) {
            // Skip very short words
            if (!index.has(word)) {
              index.set(word, []);
            }
            if (!index.get(word)!.includes(revision.id)) {
              index.get(word)!.push(revision.id);
            }
          }
        });
      });

      setSearchIndex(index);
    } finally {
      setIndexing(false);
    }
  }, [state.revisions]);

  // Rebuild index when revisions change
  useEffect(() => {
    if (state.revisions.length > 0) {
      buildSearchIndex();
    }
  }, [state.revisions.length, buildSearchIndex]);

  // Perform fast search using index
  const searchRevisions = useCallback(
    (query: string) => {
      if (!query.trim()) return state.revisions;

      const words = query.toLowerCase().match(/\w+/g) || [];
      if (words.length === 0) return state.revisions;

      // Find revisions that contain all words
      let matchingRevisionIds: number[] | null = null;

      words.forEach(word => {
        const revisionIds = searchIndex.get(word) || [];

        if (matchingRevisionIds === null) {
          matchingRevisionIds = [...revisionIds];
        } else {
          matchingRevisionIds = matchingRevisionIds.filter(id => revisionIds.includes(id));
        }
      });

      if (!matchingRevisionIds) return [];

      // Return full revision objects
      return state.revisions.filter(revision => matchingRevisionIds!.includes(revision.id));
    },
    [searchIndex, state.revisions]
  );

  // Get search suggestions
  const getSearchSuggestions = useCallback(
    (query: string) => {
      if (!query.trim() || query.length < 2) return [];

      const prefix = query.toLowerCase();
      const suggestions: string[] = [];

      for (const [word] of searchIndex.entries()) {
        if (word.startsWith(prefix) && suggestions.length < 10) {
          suggestions.push(word);
        }
      }

      return suggestions.sort();
    },
    [searchIndex]
  );

  return {
    searchRevisions,
    getSearchSuggestions,
    buildSearchIndex,
    indexing,
    indexSize: searchIndex.size,
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Synchronous diff calculation (fallback)
 */
function calculateDiffSync(oldText: string, newText: string) {
  const lines1 = oldText.split('\n');
  const lines2 = newText.split('\n');
  const maxLines = Math.max(lines1.length, lines2.length);
  const changes = [];

  for (let i = 0; i < maxLines; i++) {
    const line1 = lines1[i];
    const line2 = lines2[i];

    if (line1 !== line2) {
      if (line1 === undefined) {
        changes.push({ type: 'added', line: i + 1, content: line2 });
      } else if (line2 === undefined) {
        changes.push({ type: 'removed', line: i + 1, content: line1 });
      } else {
        changes.push({ type: 'modified', line: i + 1, old: line1, new: line2 });
      }
    }
  }

  return changes;
}

// ==================== PERFORMANCE MONITOR HOOK ====================

/**
 * Hook for monitoring revision system performance
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    diffCalculationTime: 0,
    searchTime: 0,
    memoryUsage: 0,
    cacheHitRatio: 0,
  });

  const measureRenderTime = useCallback((fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();

    setMetrics(prev => ({ ...prev, renderTime: end - start }));
  }, []);

  const measureDiffTime = useCallback(async (fn: () => Promise<any>) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    setMetrics(prev => ({ ...prev, diffCalculationTime: end - start }));
    return result;
  }, []);

  const measureSearchTime = useCallback((fn: () => any) => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    setMetrics(prev => ({ ...prev, searchTime: end - start }));
    return result;
  }, []);

  // Monitor memory usage
  useEffect(() => {
    if ('memory' in performance) {
      const updateMemory = () => {
        const memory = (performance as PerformanceWithMemory).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // MB
        }));
      };

      updateMemory();
      const interval = setInterval(updateMemory, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, []);

  return {
    metrics,
    measureRenderTime,
    measureDiffTime,
    measureSearchTime,
  };
}
