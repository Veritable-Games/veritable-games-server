'use client';

import { useRouter } from 'next/navigation';
import { formatPublicationDate } from '@/lib/utils/date-formatter';
import type { UnifiedDocument } from '@/lib/documents/types';

interface LibraryListViewProps {
  documents: UnifiedDocument[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export function LibraryListView({ documents, sortBy, sortOrder, onSort }: LibraryListViewProps) {
  const router = useRouter();

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
      className="overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900/70"
      role="table"
      aria-label="Library documents"
    >
      {/* Static Header */}
      <div className="sticky top-0 z-10 border-b border-gray-700 bg-gray-800/30" role="rowgroup">
        <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
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

      {/* Scrollable Body */}
      <div className="divide-y divide-gray-700/50" role="rowgroup">
        {documents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400" role="row">
            <p>No documents match your filters</p>
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={`${doc.source}-${doc.id}`}
              onClick={() => router.push(`/library/${doc.slug}`)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/library/${doc.slug}`);
                }
              }}
              className="grid cursor-pointer grid-cols-12 gap-2 px-3 py-1.5 transition-colors hover:bg-gray-800/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
          ))
        )}
      </div>
    </div>
  );
}
