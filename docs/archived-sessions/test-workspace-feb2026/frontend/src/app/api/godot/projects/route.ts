/**
 * GET /api/godot/projects - List all Godot projects
 * POST /api/godot/projects - Create a new Godot project
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function getProjects(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    const projects = await godotService.getProjects();

    // Transform snake_case database fields to camelCase for frontend
    const transformed = projects.map(p => ({
      slug: p.project_slug,
      title: p.title,
      description: p.description,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    logger.error('Error fetching Godot projects:', error);
    return errorResponse(error);
  }
}

async function createProject(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new AuthenticationError('Admin access required');
    }

    const { projectSlug, title, description } = await request.json();

    if (!projectSlug || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: projectSlug, title' },
        { status: 400 }
      );
    }

    // Check if project already exists
    const existing = await godotService.getProject(projectSlug);
    if (existing) {
      return NextResponse.json({ error: 'Project with this slug already exists' }, { status: 409 });
    }

    const project = await godotService.createProject(projectSlug, title, description);

    // Initialize directories
    await godotService.initializeDirectories();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Error creating Godot project:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getProjects);
export const POST = withSecurity(createProject);
