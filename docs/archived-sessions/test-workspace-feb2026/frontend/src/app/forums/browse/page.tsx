'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { LoginWidget } from '@/components/forums/LoginWidget';
import { TopicRow } from '@/components/forums/TopicRow';
import { SearchResultTable, UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import { logger } from '@/lib/utils/logger';

type SortOption = 'recent' | 'popular' | 'replies' | 'views';

export default function ForumsBrowsePage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [stats, setStats] = useState({
    totalTopics: 0,
    totalReplies: 0,
    activeToday: 0,
    totalMembers: 0,
    totalViews: 0,
    recentTopics: 0,
  });

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [topicsResponse, categoriesResponse, statsResponse] = await Promise.all([
          fetch('/api/forums/topics?limit=100'),
          fetch('/api/forums/categories'),
          fetch('/api/forums/stats'),
        ]);

        const topicsData = await topicsResponse.json();
        const categoriesData = await categoriesResponse.json();
        const statsData = await statsResponse.json();

        logger.info('Browse page - Topics API response:', topicsData);
        logger.info('Browse page - Stats API response:', statsData);

        if (topicsData.success && topicsData.data?.topics) {
          const topicsList = Array.isArray(topicsData.data.topics) ? topicsData.data.topics : [];
          logger.info(`Browse page - Found ${topicsList.length} topics`);
          setTopics(topicsList);

          // Calculate stats
          const totalReplies = topicsList.reduce(
            (sum: number, topic: any) => sum + (topic.reply_count || 0),
            0
          );
          const totalViews = topicsList.reduce(
            (sum: number, topic: any) => sum + (topic.view_count || 0),
            0
          );
          const today = new Date().toDateString();
          const activeToday = topicsList.filter(
            (topic: any) =>
              new Date(topic.created_at).toDateString() === today ||
              new Date(topic.updated_at).toDateString() === today
          ).length;
          const recentTopics = topicsList.filter((topic: any) => {
            const topicDate = new Date(topic.created_at);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return topicDate > weekAgo;
          }).length;

          // Use actual user count from stats if available
          const totalMembers = statsData?.data?.total_users || 6;

          setStats({
            totalTopics: topicsList.length,
            totalReplies,
            activeToday,
            totalMembers,
            totalViews,
            recentTopics,
          });
        } else {
          logger.info('Browse page - No topics found or invalid response structure');
          setTopics([]);
        }

        if (categoriesData.success && Array.isArray(categoriesData.data)) {
          setCategories(categoriesData.data);
        }
      } catch (error) {
        logger.error('Error loading browse data:', error);
        setTopics([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter and sort topics
  const filteredTopics = topics
    .filter(topic => {
      // Search filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        topic.title?.toLowerCase().includes(query) ||
        topic.content?.toLowerCase().includes(query) ||
        topic.author_display_name?.toLowerCase().includes(query) ||
        topic.author_username?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Apply sorting
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

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-400">Loading topics...</div>
        </div>
      </div>
    );
  }

  // Convert topics to unified format and clean up data
  const unifiedTopics = filteredTopics.map(topic => ({
    id: topic.id,
    type: 'topic' as const,
    title: String(topic.title || '').trim(), // Ensure clean title
    content: topic.content ? String(topic.content).trim() : undefined,
    username: topic.display_name || topic.username, // Use display name first
    user_id: topic.user_id,
    reply_count: Number(topic.reply_count) || 0,
    view_count: Number(topic.view_count) || 0,
    created_at: topic.created_at,
    updated_at: topic.updated_at,
    is_pinned: Boolean(topic.is_pinned),
    is_locked: Boolean(topic.is_locked),
    is_solved: Boolean(topic.is_solved),
    last_reply_at: topic.last_reply_at || topic.updated_at,
    last_reply_username: topic.last_reply_username || topic.display_name || topic.username,
    last_reply_user_id: topic.last_reply_user_id || topic.user_id,
    category_name: topic.category_name, // Now this should be populated
  }));

  const breadcrumbs = [{ label: 'Forums', href: '/forums' }, { label: 'Browse All Topics' }];

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
        href="/forums/create"
        className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
      >
        Create
      </Link>
      <Link
        href="/forums"
        className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
      >
        ← Back to Forums
      </Link>
    </>
  );

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
      <UnifiedSearchHeader
        title="Browse All Topics"
        description="Discussion boards for all game projects and community topics"
        breadcrumbs={breadcrumbs}
        searchPlaceholder="Search topics, content, or authors..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        actionButtons={actionButtons}
        loginWidget={<LoginWidget />}
      />

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {filteredTopics.length === 0 && searchQuery ? (
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
            <p className="mb-2 text-lg text-gray-300">No topics found</p>
            <p className="text-sm text-gray-400">
              No topics match "{searchQuery}". Try adjusting your search.
            </p>
          </div>
        ) : filteredTopics.length === 0 ? (
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
            <p className="mb-2 text-lg text-gray-300">No topics yet</p>
            <p className="text-sm text-gray-400">
              Be the first to start a discussion in the forums.
            </p>
            <Link
              href="/forums/create"
              className="mt-4 inline-block rounded border border-blue-500/50 bg-blue-600/20 px-4 py-2 text-blue-400 transition-colors hover:bg-blue-600/30"
            >
              Create Topic
            </Link>
          </div>
        ) : (
          <SearchResultTable items={unifiedTopics} type="forum" loading={loading} />
        )}
      </div>
    </div>
  );
}
