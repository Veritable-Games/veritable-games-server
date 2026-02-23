import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import {
  errorResponse,
  ValidationError,
  PermissionError,
  NotFoundError,
  ConflictError,
  DatabaseError,
} from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';
import { getCurrentUser } from '@/lib/auth/server';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface TeamMemberWithUser {
  id: number;
  user_id: number;
  title: string | null;
  tags: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

// GET /api/about/team-members - Fetch all team members with user data
async function getHandler(_request: NextRequest) {
  try {
    const members = await dbAdapter.query<TeamMemberWithUser>(
      `SELECT
        tm.id,
        tm.user_id,
        tm.title,
        tm.tags,
        tm.display_order,
        tm.created_at,
        tm.updated_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE u.role IN ('admin', 'developer')
      ORDER BY tm.display_order ASC, tm.created_at ASC`,
      [],
      { schema: 'content' }
    );

    // Parse tags JSON
    const formattedMembers = members.rows.map(member => ({
      ...member,
      tags: member.tags ? JSON.parse(member.tags) : [],
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    logger.error('Error fetching team members:', error);
    return errorResponse(new DatabaseError('Failed to fetch team members', error as Error));
  }
}

// POST /api/about/team-members - Create new team member entry
async function postHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const body = await request.json();
    const { user_id, title = null, tags = [], display_order } = body;

    if (!user_id) {
      return errorResponse(new ValidationError('user_id is required'));
    }

    // Validate user exists and has correct role
    const targetUser = await dbAdapter.query<{ id: number; role: string }>(
      `SELECT id, role FROM users WHERE id = $1`,
      [user_id],
      { schema: 'users' }
    );

    if (targetUser.rows.length === 0) {
      return errorResponse(new NotFoundError('User', user_id));
    }

    if (!['admin', 'developer'].includes(targetUser.rows[0]!.role)) {
      return errorResponse(new ValidationError('User must have admin or developer role'));
    }

    // Check if user is already a team member
    const existing = await dbAdapter.query<{ id: number }>(
      `SELECT id FROM team_members WHERE user_id = $1`,
      [user_id],
      { schema: 'content' }
    );

    if (existing.rows.length > 0) {
      return errorResponse(new ConflictError('User is already a team member'));
    }

    // Get next display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      const maxOrder = await dbAdapter.query<{ max_order: number | null }>(
        `SELECT MAX(display_order) as max_order FROM team_members`,
        [],
        { schema: 'content' }
      );
      finalDisplayOrder = (maxOrder.rows[0]?.max_order ?? -1) + 1;
    }

    // Insert new team member
    const tagsJson = JSON.stringify(tags);
    const result = await dbAdapter.query(
      `INSERT INTO team_members (user_id, title, tags, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user_id, title, tagsJson, finalDisplayOrder],
      { schema: 'content', returnLastId: true }
    );

    logger.info(`Team member created: ${result.lastInsertId} for user ${user_id}`);

    return NextResponse.json(
      { id: result.lastInsertId, message: 'Team member added successfully' },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating team member:', error);
    return errorResponse(new DatabaseError('Failed to create team member', error as Error));
  }
}

// PUT /api/about/team-members - Update team member
async function putHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const body = await request.json();
    const { id, title, tags, display_order } = body;

    if (!id) {
      return errorResponse(new ValidationError('id is required'));
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(tags));
    }

    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(display_order);
    }

    if (updates.length === 0) {
      return errorResponse(new ValidationError('No fields to update'));
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id to values
    values.push(id);

    const query = `UPDATE team_members SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    await dbAdapter.query(query, values, { schema: 'content' });

    logger.info(`Team member updated: ${id}`);

    return NextResponse.json({ message: 'Team member updated successfully' });
  } catch (error) {
    logger.error('Error updating team member:', error);
    return errorResponse(new DatabaseError('Failed to update team member', error as Error));
  }
}

// DELETE /api/about/team-members - Remove team member entry
async function deleteHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse(new ValidationError('id is required'));
    }

    await dbAdapter.query(`DELETE FROM team_members WHERE id = $1`, [parseInt(id)], {
      schema: 'content',
    });

    logger.info(`Team member deleted: ${id}`);

    return NextResponse.json({ message: 'Team member removed successfully' });
  } catch (error) {
    logger.error('Error deleting team member:', error);
    return errorResponse(new DatabaseError('Failed to delete team member', error as Error));
  }
}

export const GET = withSecurity(getHandler, { enableCSRF: false });
export const POST = withSecurity(postHandler, { enableCSRF: true });
export const PUT = withSecurity(putHandler, { enableCSRF: true });
export const DELETE = withSecurity(deleteHandler, { enableCSRF: true });
