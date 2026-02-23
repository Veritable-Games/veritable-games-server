'use client';

import { useState, useEffect } from 'react';
import { WikiPage } from '@/lib/wiki/types';

interface CategoryFilterBarProps {
  pages: WikiPage[];
  categoryName: string;
  onFilteredPages: (filteredPages: WikiPage[]) => void;
}

export default function CategoryFilterBar({
  pages,
  categoryName,
  onFilteredPages,
}: CategoryFilterBarProps) {
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    if (!filterQuery.trim()) {
      onFilteredPages(pages);
      return;
    }

    const query = filterQuery.toLowerCase().trim();
    const filtered = pages.filter(page => {
      // Search in title
      if (page.title.toLowerCase().includes(query)) return true;

      // Search in content
      if (page.content && page.content.toLowerCase().includes(query)) return true;

      // Search in tags
      if (
        page.tags &&
        page.tags.some(tag => {
          return tag.name.toLowerCase().includes(query);
        })
      )
        return true;

      // Search in author
      if (page.document_author && page.document_author.toLowerCase().includes(query)) return true;

      return false;
    });

    onFilteredPages(filtered);
  }, [filterQuery, pages, onFilteredPages]);

  return (
    <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-700/50 bg-gray-900/30 p-4">
      <div className="relative flex-1 overflow-hidden rounded-lg">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
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
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder={`Filter ${categoryName} pages...`}
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-600 bg-gray-800/50 py-2 pl-10 pr-10 text-sm text-white placeholder-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {filterQuery && (
          <button
            onClick={() => setFilterQuery('')}
            className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-gray-400 transition-colors hover:text-white"
            aria-label="Clear filter"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {filterQuery && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterQuery('')}
            className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition-colors hover:bg-gray-600"
          >
            Clear All
          </button>
          <span className="text-sm text-gray-400">
            {
              pages.filter(page => {
                const query = filterQuery.toLowerCase().trim();
                return (
                  page.title.toLowerCase().includes(query) ||
                  (page.content && page.content.toLowerCase().includes(query)) ||
                  (page.tags &&
                    page.tags.some(tag => {
                      return tag.name.toLowerCase().includes(query);
                    })) ||
                  (page.document_author && page.document_author.toLowerCase().includes(query))
                );
              }).length
            }{' '}
            of {pages.length} pages
          </span>
        </div>
      )}
    </div>
  );
}
