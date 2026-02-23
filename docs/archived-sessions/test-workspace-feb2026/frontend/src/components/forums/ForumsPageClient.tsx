'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ForumCategoryList } from '@/components/forums/ForumCategoryList';
import { TopicList } from '@/components/forums/TopicRow';
import { NewTopicButton } from '@/components/forums/NewTopicButton';
import ForumSearch from '@/components/forums/ForumSearch';
import { ForumHeaderActions } from '@/components/forums/ForumHeaderActions';
import type { ForumCategory, ForumTopic, ForumSection } from '@/lib/forums/types';

interface ModeState {
  selectedCount: number;
  isEditing: boolean;
  isReordering: boolean;
  isCreating: boolean;
}

interface ForumsPageClientProps {
  initialCategories: ForumCategory[];
  initialSections: ForumSection[];
  stats: {
    total_topics: number;
    total_replies: number;
    total_users: number;
    active_users_today: number;
    recent_topics: ForumTopic[];
  } | null;
  isAdmin: boolean;
}

export default function ForumsPageClient({
  initialCategories,
  initialSections,
  stats,
  isAdmin,
}: ForumsPageClientProps) {
  const [mode, setMode] = useState<ModeState>({
    selectedCount: 0,
    isEditing: false,
    isReordering: false,
    isCreating: false,
  });

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-4 py-6 md:px-6">
      {/* Styled Compact Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M4.848 2.771A49.144 49.144 0 0012 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.678 3.348-3.97z"
                  clipRule="evenodd"
                />
              </svg>
              <h1 className="text-xl font-bold text-white">
                <span className="md:hidden">Forums</span>
                <span className="hidden md:inline">Community Forums</span>
              </h1>
            </div>
            <p className="hidden text-sm text-gray-400 md:block">
              Discussion boards for all game projects and community topics
            </p>
          </div>
          <div className="shrink-0">
            <ForumHeaderActions />
          </div>
        </div>

        {/* Compact Action Bar */}
        <div className="flex items-center gap-2 rounded border border-gray-700/40 bg-gray-900/20 px-1.5 py-1">
          <div className="flex-1">
            <ForumSearch />
          </div>
          <NewTopicButton categories={initialCategories} />
          <Link
            href="/forums/browse"
            className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
          >
            Browse
          </Link>
        </div>

        {/* Forum Statistics - Header Section - hidden on mobile */}
        {stats && (
          <div className="mt-3 hidden items-center justify-between rounded border border-gray-700/60 bg-gray-900/30 px-4 py-2 text-sm md:flex">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-blue-400">{stats.total_topics}</span>
                <span className="text-gray-400">topics</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-green-400">{stats.total_replies}</span>
                <span className="text-gray-400">replies</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-purple-400">{stats.total_users}</span>
                <span className="text-gray-400">members</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-orange-400">{stats.active_users_today}</span>
                <span className="text-gray-400">active today</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-yellow-400">
                  {stats.recent_topics?.length || 0}
                </span>
                <span className="text-gray-400">recent</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div
        className="flex-1 space-y-4 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="forums-scroll-container"
      >
        {/* Categories Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Forum Categories</h2>
            {/* Admin hints and category count - hidden on mobile */}
            <div className="hidden items-center gap-3 md:flex">
              {isAdmin && mode.selectedCount > 0 && (
                <div className="text-xs text-blue-400">
                  {mode.selectedCount} selected - Tab to change visibility · Delete to remove · Esc
                  to cancel
                </div>
              )}
              {isAdmin && mode.selectedCount === 0 && !mode.isEditing && !mode.isReordering && (
                <div className="text-xs text-gray-400">
                  Ctrl+click to select · Shift+click to edit · Alt+click to reorder · Esc to cancel
                </div>
              )}
              {isAdmin && mode.isEditing && (
                <div className="text-xs text-orange-400">
                  Step 1: Edit name → Enter to confirm • Step 2: Edit description → Ctrl+Enter to
                  save • Esc to cancel
                </div>
              )}
              {isAdmin && mode.isReordering && (
                <div className="text-xs text-purple-400">
                  Reordering (use ← ↑ → ↓, Enter to save, Esc to cancel)
                </div>
              )}
              <div className="text-xs text-gray-500">{initialCategories.length} categories</div>
            </div>
          </div>

          <ForumCategoryList
            initialCategories={initialCategories}
            initialSections={initialSections}
            isAdmin={isAdmin}
            onModeChange={setMode}
          />
        </div>

        {/* Recent Topics Section */}
        {stats?.recent_topics && stats.recent_topics.length > 0 && (
          <div className="space-y-3">
            <TopicList topics={stats.recent_topics} title="Latest Discussions" />
          </div>
        )}
      </div>
    </div>
  );
}
