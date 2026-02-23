'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WikiCategory } from '@/lib/wiki/types';

interface WikiAdvancedFiltersProps {
  categories: WikiCategory[];
  onFiltersChange?: (filters: any) => void;
}

export default function WikiAdvancedFilters({
  categories,
  onFiltersChange,
}: WikiAdvancedFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Current filter values
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    author: searchParams.get('author') || '',
    tags: searchParams.get('tags') || '',
    sort: searchParams.get('sort') || 'updated',
    order: searchParams.get('order') || 'desc',
    status: searchParams.get('status') || '',
    namespace: searchParams.get('namespace') || '',
    created_after: searchParams.get('created_after') || '',
    created_before: searchParams.get('created_before') || '',
    updated_after: searchParams.get('updated_after') || '',
    updated_before: searchParams.get('updated_before') || '',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  // Check if any filters are active (excluding default sort)
  const hasActiveFilters =
    filters.category ||
    filters.author ||
    filters.tags ||
    filters.status ||
    filters.namespace ||
    filters.created_after ||
    filters.created_before ||
    filters.updated_after ||
    filters.updated_before ||
    filters.sort !== 'updated' ||
    filters.order !== 'desc';

  // Auto-expand if filters are active
  useEffect(() => {
    if (hasActiveFilters) {
      setIsExpanded(true);
    }
  }, [hasActiveFilters]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Update URL with new filters
    const params = new URLSearchParams(searchParams);

    // Preserve existing query
    const query = params.get('q');

    // Clear all filter params first
    [
      'category',
      'author',
      'tags',
      'sort',
      'order',
      'status',
      'namespace',
      'created_after',
      'created_before',
      'updated_after',
      'updated_before',
    ].forEach(param => {
      params.delete(param);
    });

    // Add non-empty filters
    Object.entries(newFilters).forEach(([key, value]) => {
      if (
        value &&
        value !== '' &&
        !(key === 'sort' && value === 'updated') &&
        !(key === 'order' && value === 'desc')
      ) {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change
    params.delete('page');

    // Navigate to updated URL
    const newUrl = `/wiki/search${params.toString() ? `?${params.toString()}` : ''}`;
    router.push(newUrl);
  };

  const clearFilters = () => {
    const query = searchParams.get('q');
    const newUrl = query ? `/wiki/search?q=${encodeURIComponent(query)}` : '/wiki/search';
    router.push(newUrl);
  };

  return (
    <div className="mb-4 rounded border border-gray-700 bg-gray-900/30">
      {/* Filter Toggle Header */}
      <div className="p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">Advanced Filters</span>
            {hasActiveFilters && (
              <span className="rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400">
                {Object.values(filters).filter(v => v && v !== 'updated' && v !== 'desc').length}{' '}
                active
              </span>
            )}
          </div>
          <svg
            className={`h-4 w-4 transform text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Filter Options */}
      {isExpanded && (
        <div className="border-t border-gray-700/50 px-3 pb-3">
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* Category Filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Category</label>
              <select
                value={filters.category}
                onChange={e => handleFilterChange('category', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.page_count})
                  </option>
                ))}
              </select>
            </div>

            {/* Author Filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Author</label>
              <input
                type="text"
                value={filters.author}
                onChange={e => handleFilterChange('author', e.target.value)}
                placeholder="Username..."
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Tags Filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Tags</label>
              <input
                type="text"
                value={filters.tags}
                onChange={e => handleFilterChange('tags', e.target.value)}
                placeholder="tag1,tag2,tag3..."
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Sort By</label>
              <select
                value={filters.sort}
                onChange={e => handleFilterChange('sort', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="title">Title (A-Z)</option>
                <option value="views">Most Viewed</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Order</label>
              <select
                value={filters.order}
                onChange={e => handleFilterChange('order', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Status</label>
              <select
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Created After Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Created After</label>
              <input
                type="date"
                value={filters.created_after}
                onChange={e => handleFilterChange('created_after', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Created Before Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Created Before</label>
              <input
                type="date"
                value={filters.created_before}
                onChange={e => handleFilterChange('created_before', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Updated After Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Updated After</label>
              <input
                type="date"
                value={filters.updated_after}
                onChange={e => handleFilterChange('updated_after', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Updated Before Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Updated Before</label>
              <input
                type="date"
                value={filters.updated_before}
                onChange={e => handleFilterChange('updated_before', e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filter Actions */}
          {hasActiveFilters && (
            <div className="mt-3 border-t border-gray-700/50 pt-3">
              <button
                onClick={clearFilters}
                className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:bg-gray-700 hover:text-white"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
