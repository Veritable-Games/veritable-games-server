import { WikiService } from '@/lib/wiki/service';
import { WikiSearchPageClient } from '@/components/wiki/WikiSearchPageClient';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth/server';
import { isMaintenanceModeEnabled } from '@/lib/auth/maintenance';
import { cookies } from 'next/headers';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';

  // Get current user
  const user = await getCurrentUser();

  // Check if authentication is required based on maintenance mode
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect(
      '/auth/login?redirect=/wiki/search' + (query ? '?q=' + encodeURIComponent(query) : '')
    );
  }

  // TypeScript: user might be null if maintenance mode is OFF
  const userRole = user?.role || 'guest';

  // Load ALL wiki pages for client-side filtering (like Library pattern)
  const wikiService = new WikiService();
  const pages = await wikiService.getAllPages(undefined, 500, userRole).catch(() => []);
  const categories = await wikiService.getCategories(userRole).catch(() => []);

  return (
    <WikiSearchPageClient
      initialPages={pages}
      initialQuery={query}
      categories={categories}
      userRole={userRole}
    />
  );
}

export default function WikiSearchPage(props: SearchPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex h-full max-w-5xl flex-col px-8 py-6">
          <div className="text-gray-400">Loading search results...</div>
        </div>
      }
    >
      <SearchResults {...props} />
    </Suspense>
  );
}
