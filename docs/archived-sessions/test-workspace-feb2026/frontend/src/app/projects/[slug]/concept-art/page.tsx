import { notFound } from 'next/navigation';
import { GalleryClient } from '../references/GalleryClient';
import { CONCEPT_ART_CONFIG } from '@/config/gallery-configs';
import type { ProjectId } from '@/lib/database/schema-types';
import { dbAdapter } from '@/lib/database/adapter';
import { serializeErrorDetail } from '@/lib/utils/serialize-error';
import { projectGalleryService } from '@/lib/projects/gallery-service';
import { logger } from '@/lib/utils/logger';

/**
 * Server Component: Project Concept Art Gallery Page
 * Fetches initial concept art data and passes to client wrapper
 * Reuses GalleryClient with CONCEPT_ART_CONFIG
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
 * Fetch concept art using the project ID (no redundant lookup)
 */
async function getInitialConceptArt(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getProjectImages('concept-art', {
      project_id: projectId,
      limit: 500,
      offset: 0,
    });

    if (!result.ok) {
      logger.error('Failed to fetch concept art:', result.error);
      return { images: [], total: 0, page: 1, limit: 500, has_more: false };
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching concept art:', errorDetail);
    return { images: [], total: 0, page: 1, limit: 500, has_more: false };
  }
}

/**
 * Fetch all concept art tags using the project ID (no redundant lookup)
 */
async function getAllTags(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getAllTags('concept-art', projectId);

    if (!result.ok) {
      logger.error('Failed to fetch concept art tags:', result.error);
      return [];
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching concept art tags:', errorDetail);
    return [];
  }
}

/**
 * Fetch all concept art albums using the project ID
 */
async function getAllAlbums(projectId: ProjectId) {
  try {
    const result = await projectGalleryService.getAlbums(projectId, 'concept-art');

    if (!result.ok) {
      logger.error('Failed to fetch concept art albums:', result.error);
      return [];
    }

    return result.value;
  } catch (error) {
    const errorDetail = serializeErrorDetail(error);
    logger.error('Error fetching concept art albums:', errorDetail);
    return [];
  }
}

export default async function ConceptArtPage({ params }: PageProps) {
  const { slug } = await params;

  // Single project lookup - reuse for all subsequent queries
  const project = await getProjectData(slug);
  if (!project) {
    notFound();
  }

  // Fetch concept art, tags, and albums in parallel using project ID (no redundant lookups)
  const [conceptArtData, tags, albums] = await Promise.all([
    getInitialConceptArt(project.id),
    getAllTags(project.id),
    getAllAlbums(project.id),
  ]);

  return (
    <GalleryClient
      config={CONCEPT_ART_CONFIG}
      projectSlug={slug}
      projectTitle={project.title}
      initialImages={conceptArtData.images}
      initialTags={tags}
      initialAlbums={albums}
      totalCount={conceptArtData.total}
    />
  );
}
