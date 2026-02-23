import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  RevisionManagerClient,
  type Revision,
} from '@/components/shared/revision-manager/RevisionManagerClient';
import { ClockIcon } from '@heroicons/react/24/outline';
import { wikiPageService, wikiRevisionService } from '@/lib/wiki/services';
import { parseWikiSlug } from '@/lib/wiki/utils/slug-parser';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface WikiHistoryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Server-side data fetching - no API route needed
 */
async function getWikiHistoryData(slug: string): Promise<{
  pageTitle: string;
  revisions: Revision[];
} | null> {
  try {
    // Parse slug to separate namespace (e.g., "library/doom-bible" → slug="doom-bible", namespace="library")
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Get page by slug to get the page ID and title
    const page = await wikiPageService.getPageBySlug(actualSlug, namespace);
    if (!page) {
      return null;
    }

    // Get all revisions for the page
    const revisions = await wikiRevisionService.getPageRevisions(page.id, { limit: 1000 });

    // Map to the Revision interface expected by RevisionManagerClient
    // Note: getPageRevisions returns author_name from JOIN with users table
    const mappedRevisions: Revision[] = revisions.map((rev: any) => ({
      id: rev.id,
      content: rev.content,
      summary: rev.summary || '',
      revision_timestamp: rev.revision_timestamp,
      author_name: rev.author_name || 'Anonymous',
      size: rev.size_bytes,
      is_minor: Boolean(rev.is_minor),
    }));

    return {
      pageTitle: page.title,
      revisions: mappedRevisions,
    };
  } catch (error) {
    logger.error('Error fetching wiki history', { slug, error });
    return null;
  }
}

/**
 * Wiki History Page - Server Component for instant rendering
 */
export default async function WikiHistoryPage({ params }: WikiHistoryPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  // Get current user
  const { getCurrentUser } = await import('@/lib/auth/server');
  const { isMaintenanceModeEnabled } = await import('@/lib/auth/maintenance');
  const user = await getCurrentUser();

  // Check if authentication is required based on maintenance mode
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect('/auth/login?redirect=/wiki/' + slug + '/history');
  }

  const data = await getWikiHistoryData(slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6 xl:max-w-6xl 2xl:max-w-7xl">
      {/* Server-rendered Header */}
      <div className="mb-4 flex-shrink-0">
        <Link
          href={`/wiki/${encodeURIComponent(resolvedParams.slug)}`}
          className="mb-3 inline-block text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Back to {data.pageTitle}
        </Link>

        <div className="mb-4 flex items-center gap-3">
          <ClockIcon className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Revision History</h1>
        </div>
      </div>

      {/* Main Content - Client Component with Server Data */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full rounded-lg border border-gray-700 bg-gray-900/70 shadow-lg">
          <RevisionManagerClient
            initialRevisions={data.revisions}
            apiPath={`/api/wiki/pages/${encodeURIComponent(resolvedParams.slug)}/revisions`}
          />
        </div>
      </div>
    </div>
  );
}
