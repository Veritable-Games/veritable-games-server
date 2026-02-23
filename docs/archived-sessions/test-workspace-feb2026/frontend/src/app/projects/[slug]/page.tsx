import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  CubeIcon,
  PhotoIcon,
  PaintBrushIcon,
  ClockIcon,
  TagIcon,
  ChartBarIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient';
import type { TracedContent, TracedContentRow } from '@/lib/tracing/types';
import { rowToTracedContent } from '@/lib/tracing/types';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

interface Project {
  id: number;
  title: string;
  slug: string;
  status: string;
  description: string;
  category: string;
  color: string;
  display_order: number;
  is_universal_system: number | boolean;
  content: string | null;
  background_content: string | null;
  created_at: string;
  updated_at: string;
}

type ProjectRevision = {
  id: number;
  author_name: string;
  summary: string;
  revision_timestamp: string;
};

interface ProjectWithContent {
  metadata: Project;
  content: string;
  last_revision?: ProjectRevision;
  // Tracing system
  tracingEnabled: boolean;
  backgroundContent: string | null;
  tracedContents: TracedContent[];
}

/**
 * Server-side data fetching - no API route needed
 */
async function getProjectData(slug: string, isAdmin: boolean): Promise<ProjectWithContent | null> {
  try {
    // Get basic project
    const projectResult = await dbAdapter.query('SELECT * FROM projects WHERE slug = $1', [slug], {
      schema: 'content',
    });
    const basicProject = projectResult.rows[0] as Project;

    if (!basicProject) {
      return null;
    }

    // Get latest revision
    const revisionResult = await dbAdapter.query(
      `SELECT id, author_name, summary, revision_timestamp
      FROM project_revisions
      WHERE project_slug = $1
      ORDER BY revision_timestamp DESC
      LIMIT 1`,
      [slug],
      { schema: 'content' }
    );
    const latestRevision = revisionResult.rows[0] as ProjectRevision;

    // Default content if none exists
    const defaultContent = `# ${basicProject.title}

## Project Overview

${basicProject.description}

This project is currently in ${basicProject.status.toLowerCase()} phase.

## Development Status

Check back for updates as development progresses.`;

    const projectContent = basicProject.content || defaultContent;
    const hasContent = projectContent.length > 0;

    // Tracing is enabled by default for all projects with content
    const tracingEnabled = hasContent;

    // Fetch traced contents (only published for non-admins)
    let tracedContents: TracedContent[] = [];
    if (hasContent) {
      try {
        const statusFilter = isAdmin ? '' : "AND status = 'published'";
        const tracesResult = await dbAdapter.query(
          `SELECT * FROM project_traced_content
           WHERE project_slug = $1 ${statusFilter}
           ORDER BY anchor_start_offset ASC NULLS LAST, created_at ASC`,
          [slug],
          { schema: 'content' }
        );
        tracedContents = (tracesResult.rows as TracedContentRow[]).map(rowToTracedContent);
      } catch (traceError) {
        // Table might not exist yet, continue without traces
        logger.warn('Could not fetch traced contents:', traceError);
      }
    }

    // Background content for admins: use explicit background_content or fall back to content
    const backgroundContent = isAdmin ? basicProject.background_content || projectContent : null;

    return {
      metadata: {
        ...basicProject,
        is_universal_system: Boolean(basicProject.is_universal_system),
      },
      content: projectContent,
      last_revision: latestRevision || undefined,
      tracingEnabled,
      backgroundContent,
      tracedContents,
    };
  } catch (error) {
    logger.error('Error fetching project:', error);
    return null;
  }
}

/**
 * Individual project page - Server Component for instant rendering
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = await params;

  // Get current user for admin check (needed for tracing data)
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'admin';

  const project = await getProjectData(resolvedParams.slug, isAdmin);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-6 py-4 xl:max-w-6xl 2xl:max-w-7xl">
        {/* Server-rendered header */}
        <div className="mb-4 flex-shrink-0">
          <Link
            href="/projects"
            className="mb-2 inline-block text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            ← Back to Projects
          </Link>
          <div className="flex flex-col items-start gap-3 @container md:flex-row md:items-center md:justify-between md:gap-6">
            {/* Left side: Title and badges */}
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="flex-shrink-0 text-2xl font-bold text-white">
                {project.metadata.title}
              </h1>
              {/* Universal System Badge - Progressive: full → truncated → icon-only */}
              {project.metadata.is_universal_system && (
                <span
                  className="flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-white"
                  title="UNIVERSAL SYSTEM"
                >
                  <GlobeAltIcon className="h-3.5 w-3.5 flex-shrink-0 @[400px]:hidden" />
                  <span className="hidden max-w-[120px] truncate @[400px]:inline @[850px]:hidden">
                    UNIVERSAL SYSTEM
                  </span>
                  <span className="hidden @[850px]:inline">UNIVERSAL SYSTEM</span>
                </span>
              )}
              {/* Category Badge - Progressive: full → truncated → icon-only */}
              {/* Skip category badge if it duplicates the Universal System badge */}
              {!(
                project.metadata.is_universal_system &&
                project.metadata.category === 'Universal System'
              ) && (
                <span
                  className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-white"
                  style={{ backgroundColor: project.metadata.color }}
                  title={project.metadata.category}
                >
                  <TagIcon className="h-3.5 w-3.5 flex-shrink-0 @[400px]:hidden" />
                  <span className="hidden max-w-[100px] truncate @[400px]:inline @[850px]:hidden">
                    {project.metadata.category}
                  </span>
                  <span className="hidden @[850px]:inline">{project.metadata.category}</span>
                </span>
              )}
              {/* Status Badge - Progressive: full → truncated → icon-only */}
              <span
                className="flex items-center gap-1.5 rounded border border-gray-600 bg-gray-800 px-2.5 py-1 font-mono text-xs text-gray-300"
                title={project.metadata.status}
              >
                <ChartBarIcon className="h-3.5 w-3.5 flex-shrink-0 @[400px]:hidden" />
                <span className="hidden max-w-[80px] truncate @[400px]:inline @[850px]:hidden">
                  {project.metadata.status}
                </span>
                <span className="hidden @[850px]:inline">{project.metadata.status}</span>
              </span>
            </div>

            {/* Right side: Navigation buttons - Transition before wrapping */}
            <div className="flex flex-shrink-0 items-center gap-2 self-end md:self-auto">
              {/* Concept Art */}
              <Link
                href={`/projects/${encodeURIComponent(resolvedParams.slug)}/concept-art`}
                className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                title="Concept Art"
              >
                <PaintBrushIcon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden @[850px]:inline">Concept Art</span>
              </Link>

              {/* References */}
              <Link
                href={`/projects/${encodeURIComponent(resolvedParams.slug)}/references`}
                className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                title="References"
              >
                <PhotoIcon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden @[850px]:inline">References</span>
              </Link>

              {/* History */}
              <Link
                href={`/projects/${encodeURIComponent(resolvedParams.slug)}/history`}
                className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                title="History"
              >
                <ClockIcon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden @[850px]:inline">History</span>
              </Link>

              {/* Admin-only Workspace */}
              {isAdmin && (
                <>
                  <span className="mx-1 text-sm text-gray-600">|</span>
                  <Link
                    href={`/projects/${encodeURIComponent(resolvedParams.slug)}/workspace`}
                    className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700/50 hover:text-white"
                    title="Workspace"
                  >
                    <CubeIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden @[850px]:inline">Workspace</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Client component for interactive features (editing, tabs) */}
        <ProjectDetailClient
          projectSlug={resolvedParams.slug}
          projectTitle={project.metadata.title}
          isAdmin={isAdmin}
          defaultContent={project.content}
          lastUpdated={project.last_revision?.revision_timestamp}
          tracingEnabled={project.tracingEnabled}
          backgroundContent={project.backgroundContent}
          tracedContents={project.tracedContents}
        />
      </div>
    </div>
  );
}
