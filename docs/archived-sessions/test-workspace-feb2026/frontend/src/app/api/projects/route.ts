import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import path from 'path';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Project database row structure
 */
interface ProjectRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string;
  color: string;
  display_order: number;
  is_universal_system: boolean | number;
  content?: string;
  background_content?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database error with code property
 */
interface DatabaseError {
  code: string;
  message: string;
}

async function GETHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const is_universal_system = searchParams.get('is_universal_system');

    let query = 'SELECT * FROM projects';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (is_universal_system !== null) {
      conditions.push(`is_universal_system = $${paramIndex++}`);
      params.push(is_universal_system === 'true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY display_order ASC, created_at ASC';

    const result = await dbAdapter.query<ProjectRow>(query, params, { schema: 'content' });
    const projects = result.rows;

    // Convert boolean fields
    const processedProjects = projects.map(project => ({
      ...project,
      is_universal_system: Boolean(project.is_universal_system),
    }));

    return NextResponse.json({ projects: processedProjects });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      slug,
      status,
      description,
      category,
      color,
      display_order,
      is_universal_system,
    } = body;

    // Validate required fields
    if (!title || !slug || !status || !description || !category || !color) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Map status to project_metadata valid values
    const metadataStatus =
      status === 'in_development' ||
      status === 'pre_production' ||
      status === 'In Development' ||
      status === 'Pre-Production'
        ? 'active'
        : status === 'Planning' || status === 'Concept'
          ? 'draft'
          : status === 'Archive'
            ? 'archived'
            : 'active';

    // Create project in transaction - both projects and project_metadata tables
    await dbAdapter.transaction(
      async adapter => {
        // Insert into projects table
        await adapter.query(
          `
        INSERT INTO projects (
          title, slug, status, description, category, color, display_order, is_universal_system
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
          [
            title,
            slug,
            status,
            description,
            category,
            color,
            display_order || 0,
            is_universal_system || false,
          ],
          { schema: 'content' }
        );

        // Insert into project_metadata table (required for workspace access)
        await adapter.query(
          `
        INSERT INTO project_metadata (
          project_slug, status, category, color, display_order, edit_locked
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
          [slug, metadataStatus, category, color, display_order || 0, false],
          { schema: 'content' }
        );
      },
      { schema: 'content' }
    );

    return NextResponse.json(
      {
        slug,
        message: 'Project created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating project:', error);
    // Check if it's a database error with code property
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as DatabaseError).code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      return NextResponse.json({ error: 'Project slug must be unique' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
export const POST = withSecurity(POSTHandler, {
  enableCSRF: true,
});
