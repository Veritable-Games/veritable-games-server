'use client';

import React from 'react';
import Link from 'next/link';
import { ContentSanitizer } from '@/lib/content/sanitization';

// Universal data interface that covers both forum topics and wiki pages
interface SearchResultItem {
  id: number;
  type: 'topic' | 'wiki';
  title: string;
  content?: string;
  highlighted_content?: string;
  highlighted_title?: string;

  // Forum-specific fields
  username?: string;
  user_id?: number;
  reply_count?: number;
  view_count?: number;
  created_at: string;
  updated_at?: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_solved?: boolean;
  last_reply_at?: string;
  last_reply_username?: string;
  last_reply_user_id?: number;
  category_name?: string;

  // Wiki-specific fields
  author?: {
    id: number;
    username: string;
    display_name?: string;
  };
  categories?: string[];
  total_views?: number;
  slug?: string;

  // Search-specific fields
  score?: number;
}

interface SearchResultTableProps {
  items: SearchResultItem[];
  type: 'forum' | 'wiki' | 'mixed';
  showCategory?: boolean;
  showRelevanceScore?: boolean;
  loading?: boolean;
}

export function SearchResultTable({
  items,
  type,
  showCategory = true,
  showRelevanceScore = false,
  loading = false,
}: SearchResultTableProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getItemUrl = (item: SearchResultItem) => {
    if (item.type === 'wiki') {
      return `/wiki/${item.slug}`;
    } else {
      return `/forums/topic/${item.id}`;
    }
  };

  const getItemViews = (item: SearchResultItem) => {
    return item.type === 'wiki' ? item.total_views || 0 : item.view_count || 0;
  };

  const getItemAuthor = (item: SearchResultItem) => {
    if (item.type === 'wiki' && item.author) {
      return {
        id: item.author.id,
        username: item.author.username,
        display_name: item.author.display_name,
      };
    } else {
      return {
        id: item.user_id,
        username: item.username,
        display_name: item.username,
      };
    }
  };

  const getItemCategory = (item: SearchResultItem) => {
    if (item.type === 'wiki') {
      return item.categories?.[0] || '';
    } else {
      return item.category_name || '';
    }
  };

  const getLastActivity = (item: SearchResultItem) => {
    if (item.type === 'wiki') {
      return {
        date: item.updated_at || item.created_at,
        author: getItemAuthor(item),
      };
    } else {
      // Forum topic - use last reply or creation
      if (item.last_reply_at && item.last_reply_username) {
        return {
          date: item.last_reply_at,
          author: {
            id: item.last_reply_user_id,
            username: item.last_reply_username,
            display_name: item.last_reply_username,
          },
        };
      } else {
        return {
          date: item.created_at,
          author: getItemAuthor(item),
        };
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900/70 p-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
        <div className="text-gray-400">Loading results...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900/70 p-8 text-center">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-gray-600"
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
        <p className="mb-2 text-lg text-gray-300">No results found</p>
        <p className="text-sm text-gray-400">
          Try adjusting your search terms or browse the categories instead
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-gray-700 bg-gray-900/70">
      {/* Column Headers */}
      <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-2">
        <div className="grid grid-cols-12 gap-6 text-xs font-medium uppercase tracking-wide text-gray-400">
          <div className="col-span-4">
            {type === 'wiki' ? 'Page' : type === 'forum' ? 'Topic' : 'Content'}
          </div>
          <div className="col-span-3">Category</div>
          <div className="col-span-2">Author</div>
          <div className="col-span-1 text-center">Views</div>
          <div className="col-span-2 text-right">Activity</div>
        </div>
      </div>

      {/* Results */}
      <div className="divide-y divide-gray-700/50">
        {items.map(item => {
          const itemUrl = getItemUrl(item);
          const itemViews = getItemViews(item);
          const itemAuthor = getItemAuthor(item);
          const itemCategory = getItemCategory(item);
          const lastActivity = getLastActivity(item);

          return (
            <div key={`${item.type}-${item.id}`} className="transition-colors hover:bg-gray-800/30">
              <Link href={itemUrl} className="block px-4 py-4">
                <div className="grid grid-cols-12 items-center gap-6">
                  {/* Page/Topic Title & Preview */}
                  <div className="col-span-4 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="truncate font-medium text-white transition-colors hover:text-blue-300">
                        {item.highlighted_title ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: ContentSanitizer.sanitizeHtml(
                                item.highlighted_title,
                                'strict'
                              ),
                            }}
                          />
                        ) : (
                          item.title
                        )}
                      </h3>

                      {/* Status icons */}
                      {item.is_pinned && (
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center"
                          title="PINNED"
                        >
                          <svg
                            className="h-4 w-4 text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                        </span>
                      )}
                      {item.is_solved && (
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center"
                          title="SOLVED"
                        >
                          <svg
                            className="h-4 w-4 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </span>
                      )}
                      {item.is_locked && (
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center"
                          title="LOCKED"
                        >
                          <svg
                            className="h-4 w-4 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </span>
                      )}

                      {/* Relevance score for search results */}
                      {showRelevanceScore && item.score && (
                        <span className="flex-shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                          {item.score.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    {(item.highlighted_content || item.content) && (
                      <div className="line-clamp-2 text-xs leading-relaxed text-gray-400">
                        {item.highlighted_content ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: ContentSanitizer.sanitizeHtml(
                                item.highlighted_content,
                                'strict'
                              ),
                            }}
                          />
                        ) : (
                          item.content?.substring(0, 120) +
                          (item.content && item.content.length > 120 ? '...' : '')
                        )}
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="col-span-3">
                    {itemCategory ? (
                      <span className="rounded bg-blue-900/30 px-2 py-1 text-xs text-blue-300">
                        {itemCategory}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </div>

                  {/* Author */}
                  <div className="col-span-2 truncate text-sm text-gray-400">
                    <span>{itemAuthor?.display_name || itemAuthor?.username || '—'}</span>
                  </div>

                  {/* Views */}
                  <div className="col-span-1 text-center">
                    <div className="flex items-center justify-center space-x-1 text-xs text-gray-400">
                      <svg
                        className="h-3 w-3"
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
                      <span>{itemViews}</span>
                    </div>
                  </div>

                  {/* Activity */}
                  <div className="col-span-2 text-right">
                    <div className="mb-1 text-xs text-gray-300">
                      {formatDate(lastActivity.date)}
                    </div>
                    <div className="text-xs text-gray-500">
                      by{' '}
                      <span>
                        {lastActivity.author?.display_name ||
                          lastActivity.author?.username ||
                          'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Unified Search Header Component
interface UnifiedSearchHeaderProps {
  title: string;
  description: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  filterElements?: React.ReactNode;
  actionButtons?: React.ReactNode;
  resultCount?: number;
  resultType?: string;
  loginWidget?: React.ReactNode;
}

export function UnifiedSearchHeader({
  title,
  description,
  breadcrumbs,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
  filterElements,
  actionButtons,
  resultCount,
  resultType = 'results',
  loginWidget,
}: UnifiedSearchHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      e.preventDefault();
      onSearchSubmit(searchValue);
    }
  };

  return (
    <div className="mb-4 flex-shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <nav className="mb-2 text-xs text-gray-400" aria-label="Breadcrumb">
            <ol className="flex items-center">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <li>
                    {crumb.href ? (
                      <Link href={crumb.href} className="transition-colors hover:text-blue-400">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white">{crumb.label}</span>
                    )}
                  </li>
                  {index < breadcrumbs.length - 1 && (
                    <li>
                      <span className="mx-2">›</span>
                    </li>
                  )}
                </React.Fragment>
              ))}
            </ol>
          </nav>
          <h1 className="mb-1 text-xl font-bold text-white">{title}</h1>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        {loginWidget}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 rounded border border-gray-700/40 bg-gray-900/20 px-1.5 py-1">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => onSearchChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-full rounded border border-gray-600 bg-gray-800 pl-8 pr-3 text-sm text-white placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none"
            />
            <svg
              className="absolute left-2.5 top-2 h-4 w-4 text-gray-500"
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
        </div>

        {/* Filters */}
        {filterElements}

        {/* Result count */}
        {typeof resultCount === 'number' && (
          <div className="px-2 text-xs text-gray-400">
            {resultCount} {resultType}
          </div>
        )}

        {/* Action buttons */}
        {actionButtons}
      </div>
    </div>
  );
}
