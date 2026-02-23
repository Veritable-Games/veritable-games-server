'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Revision, RevisionUIState } from '@/hooks/useRevisionManager';
import { useRevisionBookmarks } from '@/hooks/useRevisionBookmarks';
import { logger } from '@/lib/utils/logger';

interface SearchFilters {
  textQuery: string;
  authorFilter: string[];
  sizeRange: { min: number; max: number };
  dateRange: { start: Date | null; end: Date | null };
  contentSearch: string;
  includeBookmarked: boolean;
  excludeBookmarked: boolean;
  tagsFilter: string[];
  sizeChangeFilter: 'any' | 'increased' | 'decreased' | 'unchanged';
}

interface AdvancedRevisionSearchProps {
  revisions: Revision[];
  onFilterChange: (filteredRevisions: Revision[]) => void;
  ui: RevisionUIState;
  onSearchStateChange: (searching: boolean) => void;
  projectSlug: string;
}

export function AdvancedRevisionSearch({
  revisions,
  onFilterChange,
  ui,
  onSearchStateChange,
  projectSlug,
}: AdvancedRevisionSearchProps) {
  const { bookmarks, getAllTags } = useRevisionBookmarks(projectSlug);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    textQuery: ui.searchQuery || '',
    authorFilter: [],
    sizeRange: { min: 0, max: 0 },
    dateRange: { start: null, end: null },
    contentSearch: '',
    includeBookmarked: false,
    excludeBookmarked: false,
    tagsFilter: [],
    sizeChangeFilter: 'any',
  });

  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentSearchRef = useRef<HTMLInputElement>(null);

  // Calculate size and date ranges from revisions
  const ranges = useMemo(() => {
    if (revisions.length === 0) {
      return {
        sizeRange: { min: 0, max: 1000 },
        dateRange: { start: new Date(), end: new Date() },
        authors: [],
      };
    }

    const sizes = revisions.map(r => r.size);
    const dates = revisions.map(r => new Date(r.revision_timestamp));
    const authors = [...new Set(revisions.map(r => r.author_name))].sort();

    return {
      sizeRange: { min: Math.min(...sizes), max: Math.max(...sizes) },
      dateRange: {
        start: new Date(Math.min(...dates.map(d => d.getTime()))),
        end: new Date(Math.max(...dates.map(d => d.getTime()))),
      },
      authors,
    };
  }, [revisions]);

  // Initialize size range when revisions change
  useEffect(() => {
    if (ranges.sizeRange.min !== ranges.sizeRange.max) {
      setFilters(prev => ({
        ...prev,
        sizeRange: ranges.sizeRange,
      }));
    }
  }, [ranges.sizeRange]);

  // Advanced content search function
  const searchInContent = useCallback(
    async (query: string, targetRevisions: Revision[]) => {
      if (!query.trim()) return targetRevisions;

      setIsSearching(true);
      onSearchStateChange(true);

      // Simulate async search with debouncing
      return new Promise<Revision[]>(resolve => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
          try {
            const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
            const results = targetRevisions.filter(revision => {
              const content = revision.content?.toLowerCase() || '';
              const summary = revision.summary?.toLowerCase() || '';

              // Check if all search terms are found in content or summary
              return searchTerms.every(term => content.includes(term) || summary.includes(term));
            });

            setIsSearching(false);
            onSearchStateChange(false);
            resolve(results);
          } catch (error) {
            logger.error('Content search error:', error);
            setIsSearching(false);
            onSearchStateChange(false);
            resolve(targetRevisions);
          }
        }, 300);
      });
    },
    [onSearchStateChange]
  );

  // Apply all filters
  const filteredRevisions = useMemo(async () => {
    let filtered = [...revisions];

    // Text query filter (summary, author, ID)
    if (filters.textQuery.trim()) {
      const query = filters.textQuery.toLowerCase();
      filtered = filtered.filter(
        revision =>
          revision.summary.toLowerCase().includes(query) ||
          revision.author_name.toLowerCase().includes(query) ||
          revision.id.toString().includes(query)
      );
    }

    // Author filter
    if (filters.authorFilter.length > 0) {
      filtered = filtered.filter(revision => filters.authorFilter.includes(revision.author_name));
    }

    // Size range filter
    if (filters.sizeRange.min > 0 || filters.sizeRange.max < ranges.sizeRange.max) {
      filtered = filtered.filter(
        revision => revision.size >= filters.sizeRange.min && revision.size <= filters.sizeRange.max
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(revision => {
        const revisionDate = new Date(revision.revision_timestamp);
        const startOk = !filters.dateRange.start || revisionDate >= filters.dateRange.start;
        const endOk = !filters.dateRange.end || revisionDate <= filters.dateRange.end;
        return startOk && endOk;
      });
    }

    // Bookmark filter
    const bookmarkedIds = new Set(bookmarks.map(b => b.revisionId));
    if (filters.includeBookmarked) {
      filtered = filtered.filter(revision => bookmarkedIds.has(revision.id));
    }
    if (filters.excludeBookmarked) {
      filtered = filtered.filter(revision => !bookmarkedIds.has(revision.id));
    }

    // Tags filter
    if (filters.tagsFilter.length > 0) {
      const taggedRevisionIds = new Set();
      filters.tagsFilter.forEach(tag => {
        bookmarks.forEach(bookmark => {
          if (bookmark.tags.includes(tag)) {
            taggedRevisionIds.add(bookmark.revisionId);
          }
        });
      });
      filtered = filtered.filter(revision => taggedRevisionIds.has(revision.id));
    }

    // Size change filter
    if (filters.sizeChangeFilter !== 'any') {
      const sortedRevisions = [...revisions].sort(
        (a, b) =>
          new Date(a.revision_timestamp).getTime() - new Date(b.revision_timestamp).getTime()
      );

      const sizeChanges = new Map();
      for (let i = 1; i < sortedRevisions.length; i++) {
        const current = sortedRevisions[i];
        const previous = sortedRevisions[i - 1];
        const change = current?.size && previous?.size ? current.size - previous.size : 0;
        if (current?.id) {
          sizeChanges.set(current.id, change);
        }
      }

      filtered = filtered.filter(revision => {
        const change = sizeChanges.get(revision.id) || 0;
        switch (filters.sizeChangeFilter) {
          case 'increased':
            return change > 0;
          case 'decreased':
            return change < 0;
          case 'unchanged':
            return change === 0;
          default:
            return true;
        }
      });
    }

    // Content search (async)
    if (filters.contentSearch.trim()) {
      return searchInContent(filters.contentSearch, filtered);
    }

    return filtered;
  }, [revisions, filters, bookmarks, ranges.sizeRange.max, searchInContent]);

  // Update filtered revisions when filters change
  useEffect(() => {
    const updateFiltered = async () => {
      const result = await filteredRevisions;
      onFilterChange(result);
    };
    updateFiltered();
  }, [filteredRevisions, onFilterChange]);

  // Update filter state
  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      textQuery: '',
      authorFilter: [],
      sizeRange: ranges.sizeRange,
      dateRange: { start: null, end: null },
      contentSearch: '',
      includeBookmarked: false,
      excludeBookmarked: false,
      tagsFilter: [],
      sizeChangeFilter: 'any',
    });
  }, [ranges.sizeRange]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.textQuery.trim() !== '' ||
      filters.authorFilter.length > 0 ||
      filters.sizeRange.min > ranges.sizeRange.min ||
      filters.sizeRange.max < ranges.sizeRange.max ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.contentSearch.trim() !== '' ||
      filters.includeBookmarked ||
      filters.excludeBookmarked ||
      filters.tagsFilter.length > 0 ||
      filters.sizeChangeFilter !== 'any'
    );
  }, [filters, ranges.sizeRange]);

  if (revisions.length === 0) return null;

  return (
    <div className="rounded border border-gray-700 bg-gray-900/50">
      {/* Search Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-white">Advanced Search</h3>
            {hasActiveFilters && (
              <span className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
                Filtering Active
              </span>
            )}
            {isSearching && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent"></div>
                <span className="text-xs text-blue-400">Searching...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-gray-400 transition-colors hover:text-white"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-blue-400 transition-colors hover:text-blue-300"
            >
              {isExpanded ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search summaries, authors, IDs..."
              value={filters.textQuery}
              onChange={e => updateFilter('textQuery', e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => contentSearchRef.current?.focus()}
            className="rounded bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-500"
            title="Search in content"
          >
            📄
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <div className="space-y-4 border-b border-gray-700 p-4">
          {/* Content Search */}
          <div>
            <label className="mb-2 block text-sm text-gray-300">Search in Content</label>
            <input
              ref={contentSearchRef}
              type="text"
              placeholder="Search within revision content..."
              value={filters.contentSearch}
              onChange={e => updateFilter('contentSearch', e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
            />
            <div className="mt-1 text-xs text-gray-500">
              Searches within the actual content of revisions (may be slower)
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Author Filter */}
            <div>
              <label className="mb-2 block text-sm text-gray-300">Authors</label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-2">
                {ranges.authors.map(author => (
                  <label key={author} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={filters.authorFilter.includes(author)}
                      onChange={e => {
                        if (e.target.checked) {
                          updateFilter('authorFilter', [...filters.authorFilter, author]);
                        } else {
                          updateFilter(
                            'authorFilter',
                            filters.authorFilter.filter(a => a !== author)
                          );
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-gray-300">{author}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Size Range */}
            <div>
              <label className="mb-2 block text-sm text-gray-300">Size Range (bytes)</label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.sizeRange.min}
                    onChange={e =>
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        min: parseInt(e.target.value) || 0,
                      })
                    }
                    className="flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.sizeRange.max}
                    onChange={e =>
                      updateFilter('sizeRange', {
                        ...filters.sizeRange,
                        max: parseInt(e.target.value) || ranges.sizeRange.max,
                      })
                    }
                    className="flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Range: {ranges.sizeRange.min} - {ranges.sizeRange.max} bytes
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Date Range */}
            <div>
              <label className="mb-2 block text-sm text-gray-300">Date Range</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                  onChange={e =>
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      start: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                  className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white"
                />
                <input
                  type="date"
                  value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                  onChange={e =>
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      end: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                  className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white"
                />
              </div>
            </div>

            {/* Size Change Filter */}
            <div>
              <label className="mb-2 block text-sm text-gray-300">Size Change</label>
              <select
                value={filters.sizeChangeFilter}
                onChange={e =>
                  updateFilter(
                    'sizeChangeFilter',
                    e.target.value as SearchFilters['sizeChangeFilter']
                  )
                }
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white"
              >
                <option value="any">Any Change</option>
                <option value="increased">Increased Size</option>
                <option value="decreased">Decreased Size</option>
                <option value="unchanged">No Size Change</option>
              </select>
            </div>
          </div>

          {/* Bookmark and Tag Filters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Bookmark Filters */}
            <div>
              <label className="mb-2 block text-sm text-gray-300">Bookmarks</label>
              <div className="space-y-2">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={filters.includeBookmarked}
                    onChange={e => {
                      updateFilter('includeBookmarked', e.target.checked);
                      if (e.target.checked) {
                        updateFilter('excludeBookmarked', false);
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-gray-300">Only Bookmarked</span>
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={filters.excludeBookmarked}
                    onChange={e => {
                      updateFilter('excludeBookmarked', e.target.checked);
                      if (e.target.checked) {
                        updateFilter('includeBookmarked', false);
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-gray-300">Exclude Bookmarked</span>
                </label>
              </div>
            </div>

            {/* Tag Filters */}
            {getAllTags().length > 0 && (
              <div>
                <label className="mb-2 block text-sm text-gray-300">Tags</label>
                <div className="max-h-24 space-y-1 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-2">
                  {getAllTags().map(tag => (
                    <label key={tag} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={filters.tagsFilter.includes(tag)}
                        onChange={e => {
                          if (e.target.checked) {
                            updateFilter('tagsFilter', [...filters.tagsFilter, tag]);
                          } else {
                            updateFilter(
                              'tagsFilter',
                              filters.tagsFilter.filter(t => t !== tag)
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-gray-300">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Summary */}
      {hasActiveFilters && (
        <div className="bg-gray-800/50 p-3 text-xs text-gray-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>Active filters:</span>
            {filters.textQuery && (
              <span className="rounded bg-gray-700 px-2 py-1">Text: "{filters.textQuery}"</span>
            )}
            {filters.contentSearch && (
              <span className="rounded bg-purple-700 px-2 py-1">
                Content: "{filters.contentSearch}"
              </span>
            )}
            {filters.authorFilter.length > 0 && (
              <span className="rounded bg-gray-700 px-2 py-1">
                Authors: {filters.authorFilter.length}
              </span>
            )}
            {filters.tagsFilter.length > 0 && (
              <span className="rounded bg-gray-700 px-2 py-1">
                Tags: {filters.tagsFilter.length}
              </span>
            )}
            {filters.includeBookmarked && (
              <span className="rounded bg-yellow-700 px-2 py-1">Bookmarked Only</span>
            )}
            {filters.excludeBookmarked && (
              <span className="rounded bg-red-700 px-2 py-1">Exclude Bookmarked</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
