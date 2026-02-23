import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  RevisionManagerClient,
  type Revision,
} from '@/components/shared/revision-manager/RevisionManagerClient';
import { ClockIcon } from '@heroicons/react/24/outline';
import { dbAdapter } from '@/lib/database/adapter';
import { projectRevisionsService } from '@/lib/projects/revisions-service';
import { getServerSession } from '@/lib/auth/session';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProjectHistoryPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Server-side data fetching - no API route needed
 */
async function getProjectHistoryData(slug: string): Promise<{
  projectTitle: string;
  revisions: Revision[];
} | null> {
  try {
    // Get project by slug to get the title
    const projectResult = await dbAdapter.query(
      'SELECT title FROM projects WHERE slug = $1',
      [slug],
      { schema: 'content' }
    );
    const project = projectResult.rows[0] as { title: string } | undefined;

    if (!project) {
      return null;
    }

    // Get all revisions for the project
    const revisions = await projectRevisionsService.getRevisions(slug, { limit: 1000 });

    // Map to the Revision interface expected by RevisionManagerClient
    const mappedRevisions: Revision[] = revisions.map(rev => ({
      id: rev.id,
      content: rev.content,
      summary: rev.summary,
      revision_timestamp: rev.revision_timestamp,
      author_name: rev.author_name || 'Anonymous',
      size: rev.size_bytes,
      is_minor: Boolean(rev.is_minor),
    }));

    return {
      projectTitle: project.title,
      revisions: mappedRevisions,
    };
  } catch (error) {
    logger.error('Error fetching project history:', error);
    return null;
  }
}

/**
 * Project History Page - Server Component for instant rendering
 */
export default async function ProjectHistoryPage({ params }: ProjectHistoryPageProps) {
  const resolvedParams = await params;

  // NOTE: Revisions ALWAYS require admin access regardless of maintenance mode.
  // Only admins can access revision history
  const user = await getServerSession();
  if (user?.role !== 'admin') {
    notFound();
  }

  const data = await getProjectHistoryData(resolvedParams.slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6 xl:max-w-6xl 2xl:max-w-7xl">
      {/* Server-rendered Header */}
      <div className="mb-4 flex-shrink-0">
        <Link
          href={`/projects/${encodeURIComponent(resolvedParams.slug)}`}
          className="mb-3 inline-block text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          ← Back to {data.projectTitle}
        </Link>

        <div className="mb-4 flex items-center gap-3">
          <ClockIcon className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Versions</h1>
        </div>
      </div>

      {/* Main Content - Client Component with Server Data */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full rounded-lg border border-gray-700 bg-gray-900/70 shadow-lg">
          <RevisionManagerClient
            initialRevisions={data.revisions}
            apiPath={`/api/projects/${encodeURIComponent(resolvedParams.slug)}/revisions`}
          />
        </div>
      </div>
    </div>
  );
}
