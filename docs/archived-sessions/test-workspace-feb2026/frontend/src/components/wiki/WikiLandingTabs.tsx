'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import Link from 'next/link';

// TypeScript interfaces for the data structures
interface WikiPage {
  id: number;
  slug: string;
  title: string;
  total_views?: number; // Optional - may not have views yet
  categories?: string[];
  size_bytes?: number;
  content?: string;
  updated_at: string;
  author?: {
    username: string;
    display_name?: string;
  };
}

interface WikiActivity {
  username?: string; // May not always be available
  display_name?: string;
  action: string;
  timestamp: string;
  page_title?: string;
  page_slug?: string; // May not always be available
  categories?: string[];
  activity_type: string;
  metadata?: string | { summary?: string; change_type?: string };
}

interface WikiLandingTabsProps {
  popularPages: WikiPage[];
  recentActivity: WikiActivity[];
}

type TabType = 'popular' | 'recent';

export default function WikiLandingTabs({ popularPages, recentActivity }: WikiLandingTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('popular');
  const tabRefs = useRef<{ popular: HTMLButtonElement | null; recent: HTMLButtonElement | null }>({
    popular: null,
    recent: null,
  });

  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const tabs: TabType[] = ['popular', 'recent'];
    const currentIndex = tabs.indexOf(activeTab);

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        {
          const nextIndex = (currentIndex + 1) % tabs.length;
          const nextTab = tabs[nextIndex];
          if (nextTab) {
            setActiveTab(nextTab);
            tabRefs.current[nextTab]?.focus();
          }
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        {
          const prevIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
          const prevTab = tabs[prevIndex];
          if (prevTab) {
            setActiveTab(prevTab);
            tabRefs.current[prevTab]?.focus();
          }
        }
        break;
      case 'Home':
        e.preventDefault();
        setActiveTab('popular');
        tabRefs.current.popular?.focus();
        break;
      case 'End':
        e.preventDefault();
        setActiveTab('recent');
        tabRefs.current.recent?.focus();
        break;
    }
  };

  // Utility functions for rendering
  const generateContentPreview = (content: string | undefined) => {
    if (!content) return 'No content available';

    const preview = content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 120);

    return preview + (content.length > 120 ? '...' : '');
  };

  const timeSince = (timestamp: string | Date) => {
    const now = new Date();
    // Handle both Date objects (PostgreSQL) and strings (legacy SQLite)
    const activityDate =
      timestamp instanceof Date
        ? timestamp
        : new Date(timestamp.includes('Z') ? timestamp : timestamp + 'Z');
    const diffMs = now.getTime() - activityDate.getTime();

    // Handle future timestamps (can happen due to clock skew or timezone issues)
    if (diffMs < 0) {
      return 'just now';
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return activityDate.toLocaleDateString();
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation with Underline Design */}
      <div
        role="tablist"
        aria-label="Wiki content sections"
        className="flex items-center gap-8 border-b border-gray-700"
      >
        <button
          ref={el => {
            tabRefs.current.popular = el;
          }}
          role="tab"
          id="tab-popular"
          aria-selected={activeTab === 'popular'}
          aria-controls="panel-popular"
          tabIndex={activeTab === 'popular' ? 0 : -1}
          onClick={() => setActiveTab('popular')}
          onKeyDown={handleKeyDown}
          className={`relative pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${activeTab === 'popular' ? 'text-white' : 'text-gray-400 hover:text-gray-300'} `}
        >
          Popular Pages
          {activeTab === 'popular' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 transition-all duration-200" />
          )}
        </button>

        <button
          ref={el => {
            tabRefs.current.recent = el;
          }}
          role="tab"
          id="tab-recent"
          aria-selected={activeTab === 'recent'}
          aria-controls="panel-recent"
          tabIndex={activeTab === 'recent' ? 0 : -1}
          onClick={() => setActiveTab('recent')}
          onKeyDown={handleKeyDown}
          className={`relative pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${activeTab === 'recent' ? 'text-white' : 'text-gray-400 hover:text-gray-300'} `}
        >
          Recent Activity
          {activeTab === 'recent' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 transition-all duration-200" />
          )}
        </button>

        {/* Metadata - right aligned */}
        <div className="ml-auto">
          <span className="text-xs text-gray-500">
            {activeTab === 'popular' ? 'Most viewed' : 'Latest edits'}
          </span>
        </div>
      </div>

      {/* Popular Pages Panel */}
      <div
        id="panel-popular"
        role="tabpanel"
        aria-labelledby="tab-popular"
        hidden={activeTab !== 'popular'}
        className="space-y-3"
      >
        {popularPages.slice(0, 5).map(page => {
          const contentPreview = generateContentPreview(page.content);

          return (
            <Link
              key={page.id}
              href={`/wiki/${encodeURIComponent(page.slug)}`}
              className="block rounded border border-gray-700 bg-gray-900/30 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800/40"
            >
              <div className="space-y-2">
                {/* Title with inline category and metadata on right */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      {page.categories && page.categories.length > 0 && (
                        <span className="flex-shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">
                          {page.categories[0]}
                        </span>
                      )}
                      <h4 className="text-sm font-medium leading-tight text-white">{page.title}</h4>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
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
                      <span>{page.total_views} views</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-xs text-gray-500">
                    {page.author && (
                      <div className="mb-0.5">
                        by {page.author.display_name || page.author.username}
                      </div>
                    )}
                    <div className="text-gray-600">
                      {new Date(page.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="text-xs leading-relaxed text-gray-500">{contentPreview}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity Panel */}
      <div
        id="panel-recent"
        role="tabpanel"
        aria-labelledby="tab-recent"
        hidden={activeTab !== 'recent'}
        className="space-y-3"
      >
        {recentActivity.map((activity, index) => {
          return (
            <div
              key={index}
              className="rounded border border-gray-700 bg-gray-900/30 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800/40"
            >
              <div className="space-y-2">
                {/* Page title with inline category and timestamp on right */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {activity.page_title && activity.page_slug ? (
                      <Link
                        href={`/wiki/${encodeURIComponent(activity.page_slug)}`}
                        className="block"
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          {activity.categories && activity.categories.length > 0 && (
                            <span className="flex-shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">
                              {activity.categories[0]}
                            </span>
                          )}
                          <h4 className="text-sm font-medium leading-tight text-white transition-colors hover:text-blue-300">
                            {activity.page_title}
                          </h4>
                        </div>
                      </Link>
                    ) : (
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="flex-shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs italic text-gray-400">
                          Unknown
                        </span>
                        <h4 className="text-sm font-medium italic leading-tight text-gray-400">
                          {activity.page_slug || 'Deleted or Unknown Page'}
                        </h4>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-medium text-blue-400">
                        {activity.display_name || activity.username || 'Unknown User'}
                      </span>
                      <span className="text-gray-500">
                        {activity.action === 'create'
                          ? 'created'
                          : activity.action === 'delete'
                            ? 'deleted'
                            : activity.action === 'migrate'
                              ? 'migrated'
                              : activity.action === 'recategorize'
                                ? 'recategorized'
                                : 'edited'}{' '}
                        {activity.page_title ? 'this page' : 'a page'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-xs text-gray-500">
                    {timeSince(activity.timestamp)}
                  </div>
                </div>

                {/* Metadata box removed - users can view detailed history via the dedicated history feature */}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {recentActivity.length === 0 && (
          <div className="py-8 text-center text-gray-500">No recent activity to display</div>
        )}
      </div>
    </div>
  );
}
