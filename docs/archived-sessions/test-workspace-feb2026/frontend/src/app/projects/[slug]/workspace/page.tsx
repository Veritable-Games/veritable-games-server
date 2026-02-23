/**
 * Workspace Page
 *
 * Infinite canvas for project notes and visualizations.
 * Server Component that loads workspace data and renders canvas.
 */

import { notFound } from 'next/navigation';
import { ProjectService } from '@/lib/projects/service';
import { getServerSession } from '@/lib/auth/session';
import { UserId } from '@/types/branded';
import { isDeveloperOrAbove } from '@/lib/permissions/types';
import WorkspaceCanvas from '@/components/workspace/WorkspaceCanvas';
import { WorkspaceErrorBoundary } from '@/components/workspace/WorkspaceErrorBoundary';

// Mark as dynamic - this route requires runtime database access
export const dynamic = 'force-dynamic';

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { slug } = await params;
  const user = await getServerSession();

  // NOTE: Workspace requires admin or developer access regardless of maintenance mode.
  // Only admins and developers can access workspace
  if (!user || !isDeveloperOrAbove(user.role)) {
    notFound();
  }

  // For development, use a default user ID if not logged in
  const userId = (user?.id?.toString() || '1') as UserId;

  const projectService = new ProjectService();

  // Get project metadata and workspace
  const { project, workspace } = await projectService.getProjectWithWorkspace(slug, userId);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Header matching References banner style */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900/50 px-4 py-6">
        <div className="flex items-center gap-3">
          <a
            href={`/projects/${slug}`}
            className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            ← Back to Project
          </a>
          <div className="h-4 w-px bg-gray-600" />
          <h1 className="text-xl font-semibold text-white">
            {project.project_slug.toUpperCase()} Workspace
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400">Canvas for notes and connections</div>
        </div>
      </header>

      {/* Canvas Container */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <WorkspaceErrorBoundary fallbackType="workspace" workspaceId={workspace?.workspace?.id}>
          <WorkspaceCanvas projectSlug={slug} userId={userId} initialWorkspace={workspace} />
        </WorkspaceErrorBoundary>
      </main>
    </div>
  );
}

/**
 * Generate metadata for the page
 */
export async function generateMetadata({ params }: WorkspacePageProps) {
  const { slug } = await params;
  return {
    description: `Infinite canvas workspace for ${slug} project notes and connections`,
  };
}
