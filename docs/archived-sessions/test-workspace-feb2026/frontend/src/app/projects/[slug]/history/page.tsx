import { notFound } from 'next/navigation';
import { GalleryClient } from '../references/GalleryClient';
import { HISTORY_CONFIG } from '@/config/gallery-configs';
import type { ProjectId } from '@/lib/database/schema-types';
import { dbAdapter } from '@/lib/database/adapter';
import { serializeErrorDetail } from '@/lib/utils/serialize-error';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { logger } from '@/lib/utils/logger';

/**
 * Server Component: Project History Gallery Page
 * Fetches initial data and passes to client wrapper
 * Optimized: Static imports, single project lookup, parallel data fetching
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface ProjectData {
  id: ProjectId;
  title: string;
  slug: string;
}

/**
 * Single project lookup - reuse this data for all subsequent queries
 */
async function getProjectData(slug: string): Promise<ProjectData | null> {
  const result = await dbAdapter.query(
    'SELECT id, title, slug FROM projects WHERE slug = $1',
    [slug],
    { schema: 'content' }
  );

  return result.rows[0] || null;
}

/**
 * Fetch history images using the project ID (no redundant lookup)
 */
async function getInitialHistory(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getProjectImages('history', {
      project_id: projectId,
      limit: 500,
      offset: 0,
    });

    if (!result.ok) {
      logger.error('Failed to fetch history images:', result.error);
      return { images: [], total: 0, page: 1, limit: 500, has_more: false };
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching history images:', errorDetail);
    return { images: [], total: 0, page: 1, limit: 500, has_more: false };
  }
}

/**
 * Fetch all tags using the project ID (no redundant lookup)
 */
async function getAllTags(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getAllTags('history', projectId);

    if (!result.ok) {
      logger.error('Failed to fetch tags:', result.error);
      return [];
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching tags:', errorDetail);
    return [];
  }
}

/**
 * Fetch all albums using the project ID
 */
async function getAllAlbums(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getAlbums(projectId, 'history');

    if (!result.ok) {
      logger.error('Failed to fetch albums:', result.error);
      return [];
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching albums:', errorDetail);
    return [];
  }
}

export default async function HistoryPage({ params }: PageProps) {
  const { slug } = await params;

  // Single project lookup - reuse for all subsequent queries
  const project = await getProjectData(slug);
  if (!project) {
    notFound();
  }

  // Fetch history images, tags, and albums in parallel using project ID (no redundant lookups)
  const [historyData, tags, albums] = await Promise.all([
    getInitialHistory(project.id),
    getAllTags(project.id),
    getAllAlbums(project.id),
  ]);

  return (
    <GalleryClient
      config={HISTORY_CONFIG}
      projectSlug={slug}
      projectTitle={project.title}
      initialImages={historyData.images}
      initialTags={tags}
      initialAlbums={albums}
      totalCount={historyData.total}
    />
  );
}
