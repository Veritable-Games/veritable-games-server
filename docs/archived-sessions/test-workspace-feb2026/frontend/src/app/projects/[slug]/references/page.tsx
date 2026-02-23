import { notFound } from 'next/navigation';
import { GalleryClient } from './GalleryClient';
import { REFERENCE_CONFIG } from '@/config/gallery-configs';
import type { ProjectId } from '@/lib/database/schema-types';
import { dbAdapter } from '@/lib/database/adapter';
import { serializeErrorDetail } from '@/lib/utils/serialize-error';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { logger } from '@/lib/utils/logger';

/**
 * Server Component: Project References Gallery Page
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
 * Fetch references using the project ID (no redundant lookup)
 */
async function getInitialReferences(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getProjectImages('references', {
      project_id: projectId,
      limit: 50,
      offset: 0,
    });

    if (!result.ok) {
      logger.error('Failed to fetch references:', result.error);
      return { images: [], total: 0, page: 1, limit: 50, has_more: false };
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching references:', errorDetail);
    return { images: [], total: 0, page: 1, limit: 50, has_more: false };
  }
}

/**
 * Fetch all tags using the project ID (no redundant lookup)
 */
async function getAllTags(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getAllTags('references', projectId);

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
    const result = await projectGalleryService.getAlbums(projectId, 'references');

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

export default async function ReferencesPage({ params }: PageProps) {
  const { slug } = await params;

  // Single project lookup - reuse for all subsequent queries
  const project = await getProjectData(slug);
  if (!project) {
    notFound();
  }

  // Fetch references, tags, and albums in parallel using project ID (no redundant lookups)
  const [referencesData, tags, albums] = await Promise.all([
    getInitialReferences(project.id),
    getAllTags(project.id),
    getAllAlbums(project.id),
  ]);

  return (
    <GalleryClient
      config={REFERENCE_CONFIG}
      projectSlug={slug}
      projectTitle={project.title}
      initialImages={referencesData.images}
      initialTags={tags}
      initialAlbums={albums}
      totalCount={referencesData.total}
    />
  );
}
