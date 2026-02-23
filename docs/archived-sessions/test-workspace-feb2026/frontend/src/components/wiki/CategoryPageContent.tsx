'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WikiPage } from '@/lib/wiki/types';
import CategoryFilterBar from './CategoryFilterBar';

interface CategoryPageContentProps {
  initialPages: WikiPage[];
  categoryName: string;
  categoryId?: string;
}

export default function CategoryPageContent({
  initialPages,
  categoryName,
  categoryId,
}: CategoryPageContentProps) {
  const [filteredPages, setFilteredPages] = useState(initialPages);

  const handleFilteredPages = (pages: WikiPage[]) => {
    setFilteredPages(pages);
  };

  return (
    <>
      <CategoryFilterBar
        pages={initialPages}
        categoryName={categoryName}
        onFilteredPages={handleFilteredPages}
      />

      <div className="space-y-5">
        {filteredPages.length === 0 ? (
          <div className="rounded border border-gray-700 bg-gray-900/50 p-8 text-center">
            <div className="mb-4 text-gray-300">No pages match your filter</div>
            <div className="text-sm text-gray-400">Try adjusting your search terms</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filteredPages.map(page => (
              <div
                key={page.id}
                className="rounded border border-gray-700 bg-gray-900/50 p-6 transition-all"
              >
                <Link
                  href={`/wiki/${encodeURIComponent(page.slug)}`}
                  className="-m-2 block rounded p-2 transition-colors hover:bg-gray-800/50"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-medium text-white hover:text-blue-300">
                      {page.title}
                    </h3>

                    {/* Tag indicators */}
                    {page.tags && page.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {page.tags.slice(0, 2).map((tag, index) => {
                          // Get tag color based on type
                          const tagStr = typeof tag === 'string' ? tag : String(tag);
                          let tagColor = 'gray';

                          if (tagStr.includes('enact-symbol')) tagColor = 'green';
                          else if (tagStr.includes('central-state')) tagColor = 'purple';
                          else if (tagStr.includes('core-enact')) tagColor = 'cyan';
                          else if (tagStr.startsWith('source:')) tagColor = 'blue';
                          else if (tagStr.startsWith('theme:')) tagColor = 'purple';
                          else if (tagStr.startsWith('method:')) tagColor = 'green';

                          const colorClasses = {
                            green: 'bg-green-900/20 text-green-400/70 border-green-700/30',
                            purple: 'bg-purple-900/20 text-purple-400/70 border-purple-700/30',
                            cyan: 'bg-cyan-900/20 text-cyan-400/70 border-cyan-700/30',
                            blue: 'bg-blue-900/20 text-blue-400/70 border-blue-700/30',
                            gray: 'bg-gray-800/30 text-gray-400/70 border-gray-600/30',
                          };

                          const displayTag = tagStr
                            .replace(/^(source|theme|method):/, '')
                            .replace(/-/g, ' ');

                          return (
                            <span
                              key={index}
                              className={`rounded border px-2 py-0.5 text-xs ${colorClasses[tagColor as keyof typeof colorClasses]}`}
                            >
                              {displayTag}
                            </span>
                          );
                        })}
                        {page.tags.length > 2 && (
                          <span className="text-xs text-gray-500">+{page.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content Preview */}
                  {page.content && (
                    <p className="mb-3 line-clamp-3 text-sm text-gray-300">
                      {page.content.substring(0, 200)}
                      {page.content.length > 200 ? '...' : ''}
                    </p>
                  )}

                  {/* Meta Information */}
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center space-x-4">
                      {page.document_author && <span>by {page.document_author}</span>}
                      {page.author?.username && !page.document_author && (
                        <span>by {page.author.username}</span>
                      )}
                      <span>
                        updated {new Date(page.updated_at || page.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <span>{page.total_views || 0} views</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
