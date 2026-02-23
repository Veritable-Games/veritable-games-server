import { dbAdapter } from '@/lib/database/adapter';
import { ContentSanitizer } from '../content/sanitization';
import { projectRevisionsService } from './revisions-service';
import WorkspaceService from '../workspace/service';
import { unsafeToWorkspaceId } from '../workspace/branded-types';
import { WorkspaceWithContent } from '../workspace/types';
import { UserId } from '@/types/branded';
import { logger } from '@/lib/utils/logger';

export interface ProjectMetadata {
  project_slug: string;
  status: 'In Development' | 'Pre-Production' | 'Planning' | 'Concept' | 'Archive';
  category: string;
  color: string;
  display_order: number;
  edit_locked: boolean;
  last_major_edit?: string;
  content_structure?: any;
}

export interface ProjectSection {
  id?: number;
  project_slug: string;
  section_key: string;
  display_order: number;
  is_visible: boolean;
}

export interface ProjectWithContent {
  metadata: ProjectMetadata;
  content?: string;
  sections: ProjectSection[];
  last_revision?: any;
}

export interface ContentReference {
  id?: number;
  source_type: 'project' | 'wiki' | 'forum';
  source_id: string;
  target_type: 'project' | 'wiki' | 'forum';
  target_id: string;
  reference_context?: string;
  created_at?: string;
}

export class ProjectService {
  private workspaceService = new WorkspaceService();

  // Project metadata operations
  async getProjectMetadata(projectSlug: string): Promise<ProjectMetadata | null> {
    const result = await dbAdapter.query<ProjectMetadata>(
      `
      SELECT * FROM project_metadata
      WHERE project_slug = $1
    `,
      [projectSlug],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      return null;
    }

    const metadata = result.rows[0]!;

    if (metadata.content_structure) {
      try {
        metadata.content_structure = JSON.parse(metadata.content_structure as string);
      } catch (e) {
        metadata.content_structure = null;
      }
    }

    return metadata;
  }

  async createProjectMetadata(data: ProjectMetadata): Promise<ProjectMetadata> {
    // Create project metadata and initial content in transaction
    await dbAdapter.transaction(
      async () => {
        // Insert metadata
        await dbAdapter.query(
          `
        INSERT INTO project_metadata (
          project_slug, status, category, color,
          display_order, edit_locked, content_structure
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
          [
            data.project_slug,
            data.status,
            data.category,
            data.color,
            data.display_order,
            data.edit_locked,
            data.content_structure ? JSON.stringify(data.content_structure) : null,
          ],
          { schema: 'content' }
        );

        // Create initial project entry with default content
        const initialContent = '# Project Overview\n\nProject details coming soon...';

        await dbAdapter.query(
          `
        INSERT INTO projects (
          slug, title, description, category, status, content
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
          [
            data.project_slug,
            data.project_slug.toUpperCase(),
            `${data.project_slug.charAt(0).toUpperCase() + data.project_slug.slice(1)} project`,
            data.category,
            data.status,
            initialContent,
          ],
          { schema: 'content' }
        );
      },
      { schema: 'content' }
    );

    return data;
  }

  async updateProjectMetadata(
    projectSlug: string,
    data: Partial<ProjectMetadata>
  ): Promise<ProjectMetadata> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'project_slug' && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        if (key === 'content_structure' && value) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(projectSlug);

    const result = await dbAdapter.query(
      `
      UPDATE project_metadata
      SET ${updates.join(', ')}, last_major_edit = NOW()
      WHERE project_slug = $${paramIndex}
    `,
      params,
      { schema: 'content' }
    );

    if (result.rowCount === 0) {
      throw new Error('Project not found');
    }

    const updatedProject = await this.getProjectMetadata(projectSlug);
    if (!updatedProject) {
      throw new Error('Failed to retrieve updated project');
    }

    return updatedProject;
  }

  // Project sections operations
  async getProjectSections(projectSlug: string): Promise<ProjectSection[]> {
    const result = await dbAdapter.query<ProjectSection>(
      `
      SELECT * FROM project_sections
      WHERE project_slug = $1
      ORDER BY display_order, section_key
    `,
      [projectSlug],
      { schema: 'content' }
    );

    return result.rows;
  }

  async createProjectSection(data: Omit<ProjectSection, 'id'>): Promise<ProjectSection> {
    const result = await dbAdapter.query<ProjectSection>(
      `
      INSERT INTO project_sections (
        project_slug, section_key, display_order, is_visible
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [data.project_slug, data.section_key, data.display_order, data.is_visible],
      { schema: 'content' }
    );

    return result.rows[0]!;
  }

  // Get complete project with content
  async getProjectWithContent(projectSlug: string): Promise<ProjectWithContent | null> {
    const metadata = await this.getProjectMetadata(projectSlug);
    if (!metadata) return null;

    const sections = await this.getProjectSections(projectSlug);

    // Get project content from projects table
    let content = '';
    let lastRevision = null;

    try {
      const projectResult = await dbAdapter.query<{ content: string }>(
        `SELECT content FROM projects WHERE slug = $1`,
        [projectSlug],
        { schema: 'content' }
      );

      if (projectResult.rows.length > 0) {
        content = projectResult.rows[0]!.content || '';
      }

      // Get latest revision info from project_revisions
      const revisions = await projectRevisionsService.getRevisions(projectSlug, { limit: 1 });
      lastRevision = revisions[0] || null;
    } catch (error) {
      logger.error('Error loading project content:', error);
    }

    return {
      metadata,
      content,
      sections,
      last_revision: lastRevision,
    };
  }

  // Get project revisions through new revision system
  async getProjectRevisions(projectSlug: string, limit: number = 10): Promise<any[]> {
    return await projectRevisionsService.getRevisions(projectSlug, { limit });
  }

  // Update project content through new revision system
  async updateProjectContent(
    projectSlug: string,
    content: string,
    summary: string,
    authorId?: number,
    authorName?: string
  ): Promise<void> {
    // Sanitize content
    const sanitizedContent = ContentSanitizer.sanitizeContent(content, { level: 'safe' });

    // Create revision first
    await projectRevisionsService.createRevision({
      project_slug: projectSlug,
      content: sanitizedContent,
      summary,
      author_id: authorId,
      author_name: authorName || 'Unknown',
      is_minor: false,
    });

    // The trigger in project_revisions automatically updates projects.content
    // But we still need to update project metadata timestamp
    await this.updateProjectMetadata(projectSlug, {
      last_major_edit: new Date().toISOString(),
    });
  }

  // Content references for cross-system linking
  async createContentReference(
    data: Omit<ContentReference, 'id' | 'created_at'>
  ): Promise<ContentReference> {
    const result = await dbAdapter.query<ContentReference>(
      `
      INSERT INTO content_references (
        source_type, source_id, target_type, target_id, reference_context
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [
        data.source_type,
        data.source_id,
        data.target_type,
        data.target_id,
        data.reference_context || null,
      ],
      { schema: 'content' }
    );

    return result.rows[0]!;
  }

  async getContentReferences(sourceType: string, sourceId: string): Promise<ContentReference[]> {
    const result = await dbAdapter.query<ContentReference>(
      `
      SELECT * FROM content_references
      WHERE source_type = $1 AND source_id = $2
      ORDER BY created_at DESC
    `,
      [sourceType, sourceId],
      { schema: 'content' }
    );

    return result.rows;
  }

  // Initialize default projects from existing data
  async initializeDefaultProjects(): Promise<void> {
    const defaultProjects = [
      {
        project_slug: 'noxii',
        status: 'In Development' as const,
        category: 'Action-Adventure',
        color: '#DC2626',
        display_order: 0,
        edit_locked: false,
      },
      {
        project_slug: 'autumn',
        status: 'Pre-Production' as const,
        category: 'Adventure',
        color: '#EA580C',
        display_order: 1,
        edit_locked: false,
      },
      {
        project_slug: 'dodec',
        status: 'Planning' as const,
        category: 'Sci-Fi Adventure',
        color: '#0891B2',
        display_order: 2,
        edit_locked: false,
      },
      {
        project_slug: 'on-command',
        status: 'Concept' as const,
        category: 'Tactical Shooter',
        color: '#7C3AED',
        display_order: 3,
        edit_locked: false,
      },
      {
        project_slug: 'cosmic-knights',
        status: 'Concept' as const,
        category: 'Co-op Shooter',
        color: '#059669',
        display_order: 4,
        edit_locked: false,
      },
      {
        project_slug: 'project-coalesce',
        status: 'Archive' as const,
        category: 'Platformer',
        color: '#4338CA',
        display_order: 5,
        edit_locked: false,
      },
    ];

    for (const project of defaultProjects) {
      try {
        const existing = await this.getProjectMetadata(project.project_slug);
        if (!existing) {
          await this.createProjectMetadata(project);
          logger.info(`Initialized project: ${project.project_slug}`);
        }
      } catch (error) {
        logger.error(`Error initializing project ${project.project_slug}:`, error);
      }
    }
  }

  // Get all projects for listing
  async getAllProjects(): Promise<ProjectMetadata[]> {
    const result = await dbAdapter.query<ProjectMetadata>(
      `
      SELECT * FROM project_metadata
      ORDER BY display_order, project_slug
    `,
      [],
      { schema: 'content' }
    );

    return result.rows.map(metadata => {
      if (metadata.content_structure) {
        try {
          metadata.content_structure = JSON.parse(metadata.content_structure as string);
        } catch (e) {
          metadata.content_structure = null;
        }
      }
      return metadata;
    });
  }

  // ========================================================================
  // Workspace Integration
  // ========================================================================

  /**
   * Get or create workspace for a project
   * Ensures every project has a workspace ready for the canvas
   */
  async getOrCreateWorkspace(
    projectSlug: string,
    userId: UserId
  ): Promise<WorkspaceWithContent | null> {
    try {
      const workspaceId = unsafeToWorkspaceId(projectSlug);

      // Try to get existing workspace with content
      const existingResult = await this.workspaceService.getWorkspaceWithContent(
        workspaceId,
        userId
      );

      if (existingResult.ok) {
        return existingResult.value;
      }

      // Workspace doesn't exist, create it
      const createResult = await this.workspaceService.createWorkspace(
        { project_slug: projectSlug },
        userId
      );

      if (!createResult.ok) {
        logger.error('Failed to create workspace:', createResult.error);
        return null;
      }

      // Get the newly created workspace with content
      const contentResult = await this.workspaceService.getWorkspaceWithContent(
        workspaceId,
        userId
      );

      return contentResult.ok ? contentResult.value : null;
    } catch (error) {
      logger.error('Error in getOrCreateWorkspace:', error);
      return null;
    }
  }

  /**
   * Get project metadata along with its workspace
   * Convenient method for loading project page with workspace link
   */
  async getProjectWithWorkspace(
    projectSlug: string,
    userId: UserId
  ): Promise<{
    project: ProjectMetadata | null;
    workspace: WorkspaceWithContent | null;
  }> {
    const project = await this.getProjectMetadata(projectSlug);
    const workspace = project ? await this.getOrCreateWorkspace(projectSlug, userId) : null;

    return {
      project,
      workspace,
    };
  }
}

// Create singleton instance and export
const projectService = new ProjectService();

export { projectService };

export const getProjectRevisions = (projectSlug: string, limit?: number) =>
  projectService.getProjectRevisions(projectSlug, limit);
