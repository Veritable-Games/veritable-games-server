'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { TopicRow } from '@/components/forums/TopicRow';
import { LoginWidget } from '@/components/forums/LoginWidget';
import { UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/utils/logger';

type SortOption = 'recent' | 'popular' | 'replies' | 'views';

export default function CategoryPage() {
  const params = useParams();
  const categorySlug = params.slug as string;
  const { isAuthenticated } = useAuth();

  const [category, setCategory] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);

  useEffect(() => {
    async function loadCategoryData() {
      try {
        setLoading(true);

        if (!categorySlug) {
          logger.error('[CategoryPage] ERROR: Missing categorySlug');
          notFound();
          return;
        }

        logger.info('[CategoryPage] Loading category:', categorySlug);

        // Fetch category and topics from API routes using slug
        const [categoryResponse, topicsResponse] = await Promise.all([
          fetch(`/api/forums/categories/${categorySlug}`),
          fetch(`/api/forums/topics?category=${categorySlug}&limit=50`),
        ]);

        if (!categoryResponse.ok) {
          logger.error(
            `[CategoryPage] ERROR: Category API failed: ${categoryResponse.status} ${categoryResponse.statusText}`
          );
          notFound();
          return;
        }

        const categoryResult = await categoryResponse.json();
        logger.info('[CategoryPage] Category result:', categoryResult);

        if (!categoryResult.success || !categoryResult.data?.category) {
          logger.error('[CategoryPage] ERROR: Invalid category result:', categoryResult);
          notFound();
          return;
        }
        setCategory(categoryResult.data.category);

        const topicsResult = await topicsResponse.json();
        const topicsData =
          topicsResult.success && Array.isArray(topicsResult.data?.topics)
            ? topicsResult.data.topics
            : [];

        logger.info('[CategoryPage] Loaded topics:', topicsData.length);
        setTopics(topicsData);
        setFilteredTopics(topicsData);
      } catch (error) {
        logger.error('[CategoryPage] EXCEPTION during load:', error);
        logger.error(
          '[CategoryPage] Error stack:',
          error instanceof Error ? error.stack : 'No stack trace'
        );
        notFound();
      } finally {
        setLoading(false);
      }
    }

    if (categorySlug) {
      loadCategoryData();
    }
  }, [categorySlug]);

  // Handle search and sort
  useEffect(() => {
    // Ensure topics is always an array
    if (!Array.isArray(topics)) {
      setFilteredTopics([]);
      return;
    }

    let filtered = [...topics];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        topic =>
          topic.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          topic.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'replies':
          return (b.reply_count || 0) - (a.reply_count || 0);
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'recent':
        default:
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
      }
    });

    setFilteredTopics(filtered);
  }, [topics, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">Loading category...</div>
        </div>
      </div>
    );
  }

  if (!category) {
    notFound();
  }

  // Breadcrumbs for header
  const breadcrumbs = [{ label: 'Forums', href: '/forums' }, { label: category.name }];

  // Action buttons for header
  const actionButtons = (
    <>
      <select
        value={sortBy}
        onChange={e => setSortBy(e.target.value as SortOption)}
        className="h-8 rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 focus:border-gray-500/60 focus:outline-none"
      >
        <option value="recent">Most Recent</option>
        <option value="popular">Most Popular</option>
        <option value="replies">Most Replies</option>
        <option value="views">Most Views</option>
      </select>

      <Link
        href={`/forums/create?category=${category?.slug || categorySlug}`}
        className="flex h-8 items-center rounded bg-blue-600 px-3 text-sm text-white transition-colors hover:bg-blue-700"
      >
        + New Topic
      </Link>

      <Link
        href="/forums"
        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
      >
        ← Back
      </Link>
    </>
  );

  // Safety check: ensure filteredTopics is always an array
  const safeFilteredTopics = Array.isArray(filteredTopics) ? filteredTopics : [];

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
      <UnifiedSearchHeader
        title={category.name}
        description={category.description || ''}
        breadcrumbs={breadcrumbs}
        searchPlaceholder="Search topics..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        actionButtons={actionButtons}
        loginWidget={<LoginWidget />}
      />

      {/* Main Content - Scrollable */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {/* Topics Section */}
        <div className="space-y-3">
          {safeFilteredTopics.length === 0 ? (
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
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="mb-2 text-lg text-gray-300">
                {searchQuery ? 'No topics found' : 'No topics yet'}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery
                  ? `No topics match "${searchQuery}". Try adjusting your search.`
                  : 'Be the first to start a discussion in this category.'}
              </p>
              {!searchQuery && (
                <Link
                  href={`/forums/create?category=${category?.slug || categorySlug}`}
                  className="mt-4 inline-block rounded border border-blue-500/50 bg-blue-600/20 px-4 py-2 text-blue-400 transition-colors hover:bg-blue-600/30"
                >
                  Create Topic
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70 backdrop-blur">
              {/* Table Header */}
              <div className="border-b border-gray-700 bg-gray-800/50 px-4 py-2">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <div className="col-span-6">Topic</div>
                  <div className="col-span-2 text-center">Replies</div>
                  <div className="col-span-2 text-center">Views</div>
                  <div className="col-span-2 text-right">Activity</div>
                </div>
              </div>

              {/* Topics - Separate pinned from regular */}
              <div>
                {/* Pinned Topics Section */}
                {safeFilteredTopics.filter(t => t.is_pinned).length > 0 && (
                  <>
                    {/* Pinned Topics */}
                    <div className="divide-y divide-gray-700">
                      {safeFilteredTopics
                        .filter(t => t.is_pinned)
                        .map(topic => (
                          <TopicRow key={topic.id} topic={topic} />
                        ))}
                    </div>

                    {/* Visual separator if there are also regular topics */}
                    {safeFilteredTopics.filter(t => !t.is_pinned).length > 0 && (
                      <div className="relative my-1 border-t-2 border-gray-600">
                        <div className="absolute -top-2 left-4 bg-gray-800 px-2 text-[10px] uppercase tracking-wider text-gray-500">
                          Regular Topics
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Regular Topics */}
                <div className="divide-y divide-gray-700">
                  {safeFilteredTopics
                    .filter(t => !t.is_pinned)
                    .map(topic => (
                      <TopicRow key={topic.id} topic={topic} />
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
