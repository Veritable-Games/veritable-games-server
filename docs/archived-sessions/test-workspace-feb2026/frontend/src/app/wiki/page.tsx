import { WikiService } from '@/lib/wiki/service';
import type { WikiPage, UnifiedActivity } from '@/lib/wiki/types';
import { getCurrentUser } from '@/lib/auth/server';
import { isMaintenanceModeEnabled } from '@/lib/auth/maintenance';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';
import WikiSearch from '@/components/wiki/WikiSearch';
import WikiCategoriesGrid from '@/components/wiki/WikiCategoriesGrid';
import WikiLandingTabs from '@/components/wiki/WikiLandingTabs';
import Link from 'next/link';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering - disable Next.js caching for this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getWikiData() {
  const wikiService = new WikiService();

  // Get current user
  const user = await getCurrentUser();

  // Check if authentication is required based on maintenance mode
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect('/auth/login?redirect=/wiki');
  }

  // TypeScript: user might be null if maintenance mode is OFF
  const userRole = user?.role || 'guest';

  try {
    const [categories, stats, recentActivity, popularPages, recentPages] = await Promise.all([
      wikiService.getCategories(userRole),
      wikiService.getWikiStats(),
      wikiService.getRecentActivity(6),
      wikiService.getPopularPages(5, userRole),
      wikiService.getRecentPages(5, userRole),
    ]);
    return { categories, stats, recentActivity, popularPages, recentPages, user };
  } catch (error) {
    logger.error('Error loading wiki data', { error });
    return {
      categories: [],
      stats: null,
      recentActivity: [] as UnifiedActivity[],
      popularPages: [],
      recentPages: [],
      user,
    };
  }
}

export default async function WikiPage() {
  const { categories, stats, recentActivity, popularPages, recentPages, user } =
    await getWikiData();

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-6 py-6">
      {/* Styled Compact Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
                  clipRule="evenodd"
                />
                <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
              </svg>
              <h1 className="text-xl font-bold text-white">Wiki</h1>
            </div>
            <p className="hidden text-sm text-gray-400 md:block">
              Game documentation, technical guides, and community resources
            </p>
          </div>
          <div className="shrink-0">
            <ClientWikiHeader />
          </div>
        </div>

        {/* Compact Action Bar */}
        <div className="flex items-center gap-2 rounded border border-gray-700/40 bg-gray-900/20 px-1.5 py-1">
          <div className="flex-1">
            <WikiSearch />
          </div>
          <Link
            href="/wiki/create"
            className="flex h-8 items-center rounded border border-blue-500/50 bg-gray-800/40 px-3 text-sm text-blue-400 transition-colors hover:border-blue-400/70 hover:bg-gray-700/60 hover:text-blue-300"
          >
            Create
          </Link>
          <Link
            href="/wiki/search"
            className="flex h-8 items-center rounded border border-gray-600/40 bg-gray-800/40 px-3 text-sm text-gray-300 transition-colors hover:border-gray-500/60 hover:bg-gray-700/60 hover:text-white"
          >
            Browse
          </Link>
        </div>

        {/* Wiki Statistics - TEMPORARILY HIDDEN
        <div className="mt-3 hidden items-center justify-between rounded border border-gray-700/60 bg-gray-900/30 px-4 py-2 text-sm md:flex">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-blue-400">{stats?.total_pages ?? 0}</span>
              <span className="text-gray-400">pages</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-green-400">{stats?.total_views ?? 0}</span>
              <span className="text-gray-400">views</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-purple-400">
                {stats?.active_editors_month ?? 0}
              </span>
              <span className="text-gray-400">editors</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-orange-400">{stats?.recent_edits_week ?? 0}</span>
              <span className="text-gray-400">edits this week</span>
            </div>
          </div>
        </div>
        */}
      </div>

      {/* Main Content */}
      <div
        className="flex-1 space-y-4 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="wiki-scroll-container"
      >
        {/* Categories Section */}
        <WikiCategoriesGrid
          initialCategories={categories}
          isAdmin={user?.role === 'admin' || user?.role === 'moderator'}
        />

        {/* Wiki Landing Tabs - Popular Pages and Recent Activity */}
        {(popularPages.length > 0 || recentActivity.length > 0) && (
          <WikiLandingTabs popularPages={popularPages} recentActivity={recentActivity} />
        )}
      </div>
    </div>
  );
}
