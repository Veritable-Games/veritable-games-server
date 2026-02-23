'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoginWidget } from '@/components/forums/LoginWidget';
import { SearchResultTable, UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import type { Category } from './ForumSearchServer';
import { logger } from '@/lib/utils/logger';

interface SearchResult {
  id: number;
  type: 'topic' | 'reply';
  title?: string;
  content: string;
  highlighted_content: string;
  highlighted_title?: string;
  author_username: string;
  author_display_name?: string;
  category_name?: string;
  created_at: string;
  topic_id?: number;
  score: number;
  view_count?: number;
  reply_count?: number;
}

interface SearchFilters {
  category_id?: string;
  sort_by: 'relevance' | 'recent' | 'popular' | 'replies' | 'views';
}

interface ForumSearchClientProps {
  initialCategories: Category[];
}

export function ForumSearchClient({ initialCategories }: ForumSearchClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({
    category_id: searchParams.get('category_id') || undefined,
    sort_by:
      (searchParams.get('sort_by') as 'relevance' | 'recent' | 'popular' | 'replies' | 'views') ||
      'relevance',
  });

  // Perform search with debouncing (300ms delay)
  useEffect(() => {
    if (query.trim()) {
      const debounceTimer = setTimeout(() => {
        performSearch();
      }, 300); // Wait 300ms after user stops typing

      return () => clearTimeout(debounceTimer);
    } else {
      setResults([]);
      setTotal(0);
    }
  }, [query, filters]);

  const performSearch = async () => {
    if (!query.trim()) return;

    // Update URL to match current search state
    updateURL(query, filters);

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        scope: 'topics', // Only search topics (reply search not implemented)
        sort_by: filters.sort_by,
        limit: '50',
      });

      if (filters.category_id) {
        params.append('category_id', filters.category_id);
      }

      const response = await fetch(`/api/forums/search?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          // Transform SearchResultDTO[] to SearchResult[]
          const transformedResults = (json.data.results || []).map((result: any) => ({
            id: result.id,
            type: result.content_type as 'topic' | 'reply',
            title: result.title,
            content: result.content,
            highlighted_content: result.highlight || result.content,
            highlighted_title: result.title,
            author_username: result.author_username,
            author_display_name: result.author_username, // Use username as display name for now
            category_name: result.category_name,
            created_at: result.created_at,
            topic_id: result.topic_id,
            view_count: result.view_count || 0,
            reply_count: result.reply_count || 0,
            score: result.rank || 0,
          }));
          setResults(transformedResults);
          setTotal(json.data.pagination?.total || 0);
        } else {
          logger.error('Search failed - invalid response format');
          setResults([]);
          setTotal(0);
        }
      } else {
        logger.error('Search failed - HTTP error:', response.status);
        setResults([]);
        setTotal(0);
      }
    } catch (error) {
      logger.error('Error performing search:', error);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    updateURL(query, updatedFilters);
  };

  const updateURL = (searchQuery: string, searchFilters: SearchFilters) => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (searchFilters.category_id) params.append('category_id', searchFilters.category_id);
    if (searchFilters.sort_by !== 'relevance') params.append('sort_by', searchFilters.sort_by);

    router.push(`/forums/search?${params.toString()}`);
  };

  // Convert search results to unified format
  const unifiedResults = results.map(result => ({
    id: result.id,
    type: 'topic' as const, // Always map to 'topic' for display
    title: result.title || '',
    content: result.content,
    highlighted_content: result.highlighted_content,
    highlighted_title: result.highlighted_title,
    username: result.author_display_name || result.author_username,
    user_id: result.id, // Using result id since we don't have user_id in search results
    view_count: result.view_count || 0,
    reply_count: result.reply_count || 0,
    created_at: result.created_at,
    category_name: result.category_name,
    score: result.score,
  }));

  const breadcrumbs = [{ label: 'Forums', href: '/forums' }, { label: 'Search' }];

  const filterElements = (
    <div className="flex items-center gap-2">
      <select
        value={filters.category_id || ''}
        onChange={e => handleFilterChange({ category_id: e.target.value || undefined })}
        className="h-8 rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 focus:border-blue-500 focus:outline-none"
      >
        <option value="">All Categories</option>
        {initialCategories.map(category => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <select
        value={filters.sort_by}
        onChange={e =>
          handleFilterChange({
            sort_by: e.target.value as 'relevance' | 'recent' | 'popular' | 'replies' | 'views',
          })
        }
        className="h-8 rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 focus:border-blue-500 focus:outline-none"
      >
        <option value="relevance">Best Match</option>
        <option value="recent">Most Recent</option>
        <option value="popular">Most Popular</option>
        <option value="replies">Most Replies</option>
        <option value="views">Most Views</option>
      </select>
    </div>
  );

  const actionButtons = (
    <>
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
        title="Forum Search"
        description="Search topics, replies, and community discussions"
        breadcrumbs={breadcrumbs}
        searchPlaceholder="Search forums..."
        searchValue={query}
        onSearchChange={setQuery}
        filterElements={filterElements}
        actionButtons={actionButtons}
        resultCount={loading ? undefined : total}
        resultType={total === 1 ? 'result' : 'results'}
        loginWidget={<LoginWidget />}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {query ? (
          <SearchResultTable items={unifiedResults} type="forum" loading={loading} />
        ) : (
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
            <p className="mb-2 text-lg text-gray-300">Search the Forums</p>
            <p className="text-sm text-gray-400">
              Enter a search query to find topics, replies, and discussions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
