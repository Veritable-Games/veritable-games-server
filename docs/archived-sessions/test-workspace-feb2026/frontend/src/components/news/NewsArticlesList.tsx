'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/utils/logger';

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  author: string;
  published_at: string;
  featured_image?: string;
  tags?: string | string[]; // Can be JSON string (SSR) or array (API)
}

interface NewsArticlesListProps {
  initialArticles: NewsArticle[];
  isAdmin: boolean;
}

export function NewsArticlesList({ initialArticles, isAdmin }: NewsArticlesListProps) {
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [offset, setOffset] = useState(initialArticles.length);
  const [hasMore, setHasMore] = useState(initialArticles.length >= 10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Map tags to Heroicons
  const getTagIcon = (tag: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      announcement: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
      ),
      update: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
      features: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
      development: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
      security: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      performance: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      optimization: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      community: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      documentation: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      welcome: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      platform: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
      default: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      ),
    };
    return iconMap[tag.toLowerCase()] || iconMap['default'];
  };

  const loadMoreArticles = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/news?offset=${offset}&limit=10&status=published`);
      if (!response.ok) throw new Error('Failed to fetch articles');

      const data = await response.json();
      const newArticles = data.articles || [];

      if (newArticles.length > 0) {
        setArticles(prev => [...prev, ...newArticles]);
        setOffset(prev => prev + newArticles.length);
        setHasMore(data.pagination?.hasMore || false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      logger.error('Error loading more articles:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, offset]);

  return (
    <div className="space-y-4">
      {/* Create New Article Box (Admin Only) - At Top */}
      {isAdmin && (
        <Link
          href="/news/create"
          className="group block rounded border border-gray-700 bg-gray-900/70 p-6 transition-colors hover:bg-gray-800/90"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 transition-colors group-hover:bg-gray-700">
              <svg
                className="h-6 w-6 text-blue-400 transition-colors group-hover:text-blue-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <div className="text-base font-medium text-white transition-colors group-hover:text-blue-300">
                Create New Article
              </div>
              <div className="text-sm text-gray-400">Write and publish a new news article</div>
            </div>
          </div>
        </Link>
      )}

      {/* Articles List */}
      {articles.map(article => {
        const publishDate = new Date(article.published_at);
        const formattedDate = publishDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const shortDate = publishDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        // Tags can be a string (from SSR) or array (from API)
        const tags = Array.isArray(article.tags)
          ? article.tags
          : article.tags
            ? JSON.parse(article.tags)
            : [];
        const primaryTag = tags[0] || 'default';
        const tagIcon = getTagIcon(primaryTag);

        return (
          <Link
            key={article.id}
            href={`/news/${article.slug}`}
            className="block rounded border border-gray-700 bg-gray-900/70 p-4 transition-colors hover:bg-gray-900/90"
          >
            <article>
              {/* Header: Icon, Title, Date */}
              <div className="mb-2 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 text-blue-400">{tagIcon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-tight text-white md:text-lg">
                      {article.title}
                    </h2>
                    {/* Short date on mobile, full date on desktop */}
                    <time className="flex-shrink-0 text-xs text-gray-500 md:text-sm md:text-gray-400">
                      <span className="md:hidden">{shortDate}</span>
                      <span className="hidden md:inline">{formattedDate}</span>
                    </time>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="mb-2 text-sm text-gray-300 md:mb-3 md:text-base">{article.summary}</p>

              {/* Footer: Author (desktop only), Tags (truncated), Read more (desktop only) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {/* Author - hidden on mobile */}
                  <span className="hidden flex-shrink-0 text-sm text-gray-500 md:inline">
                    By {article.author}
                  </span>
                  {/* Separator - hidden on mobile */}
                  {tags.length > 0 && <span className="hidden text-gray-600 md:inline">·</span>}
                  {/* Tags - truncate on mobile */}
                  {tags.length > 0 && (
                    <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                      {tags.slice(0, 4).map((tag: string) => (
                        <span
                          key={tag}
                          className="flex-shrink-0 truncate rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 4 && (
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          +{tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Read more - hidden on mobile (whole card is clickable) */}
                <span className="hidden flex-shrink-0 text-sm text-blue-400 md:inline">
                  Read more →
                </span>
              </div>
            </article>
          </Link>
        );
      })}

      {/* Intersection Observer Target - Only show when there's more content */}
      {hasMore && <div ref={observerTarget} className="h-4" />}

      {/* End of List Message Card */}
      {!hasMore && articles.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/70 p-6 text-center">
          <div className="text-sm text-gray-500">You've reached the end of the news feed</div>
        </div>
      )}
    </div>
  );
}
