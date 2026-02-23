import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import {
  errorResponse,
  ValidationError,
  PermissionError,
  DatabaseError,
} from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';
import { getCurrentUser } from '@/lib/auth/server';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface CommissionCredit {
  id: number;
  project_name: string;
  client_name: string;
  project_type: string | null;
  year: number | null;
  description: string | null;
  url: string | null;
  color: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// GET /api/about/commission-credits - Fetch all commission credits
async function getHandler(_request: NextRequest) {
  try {
    const credits = await dbAdapter.query<CommissionCredit>(
      `SELECT * FROM commission_credits
       ORDER BY display_order ASC, year DESC NULLS LAST`,
      [],
      { schema: 'content' }
    );

    return NextResponse.json({ credits: credits.rows });
  } catch (error) {
    logger.error('Error fetching commission credits:', error);
    return errorResponse(new DatabaseError('Failed to fetch commission credits', error as Error));
  }
}

// POST /api/about/commission-credits - Create new commission credit
async function postHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const body = await request.json();
    const {
      project_name,
      client_name,
      description = null,
      project_type = null,
      color = null,
      year = null,
      url = null,
      display_order,
    } = body;

    if (!project_name || !client_name) {
      return errorResponse(new ValidationError('project_name and client_name are required'));
    }

    // Get next display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      const maxOrder = await dbAdapter.query<{ max_order: number | null }>(
        `SELECT MAX(display_order) as max_order FROM commission_credits`,
        [],
        { schema: 'content' }
      );
      finalDisplayOrder = (maxOrder.rows[0]?.max_order ?? -1) + 1;
    }

    // Insert new commission credit
    const result = await dbAdapter.query(
      `INSERT INTO commission_credits
       (project_name, client_name, description, project_type, color, year, url, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [project_name, client_name, description, project_type, color, year, url, finalDisplayOrder],
      { schema: 'content', returnLastId: true }
    );

    logger.info(`Commission credit created: ${result.lastInsertId}`);

    return NextResponse.json(
      { id: result.lastInsertId, message: 'Commission credit added successfully' },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating commission credit:', error);
    return errorResponse(new DatabaseError('Failed to create commission credit', error as Error));
  }
}

// PUT /api/about/commission-credits - Update commission credit
async function putHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const body = await request.json();
    const { id, project_name, client_name, description, project_type, color, year, url } = body;

    if (!id) {
      return errorResponse(new ValidationError('id is required'));
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (project_name !== undefined) {
      updates.push(`project_name = $${paramIndex++}`);
      values.push(project_name);
    }

    if (client_name !== undefined) {
      updates.push(`client_name = $${paramIndex++}`);
      values.push(client_name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (project_type !== undefined) {
      updates.push(`project_type = $${paramIndex++}`);
      values.push(project_type);
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(color);
    }

    if (year !== undefined) {
      updates.push(`year = $${paramIndex++}`);
      values.push(year);
    }

    if (url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(url);
    }

    if (updates.length === 0) {
      return errorResponse(new ValidationError('No fields to update'));
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id to values
    values.push(id);

    const query = `UPDATE commission_credits SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    await dbAdapter.query(query, values, { schema: 'content' });

    logger.info(`Commission credit updated: ${id}`);

    return NextResponse.json({ message: 'Commission credit updated successfully' });
  } catch (error) {
    logger.error('Error updating commission credit:', error);
    return errorResponse(new DatabaseError('Failed to update commission credit', error as Error));
  }
}

// DELETE /api/about/commission-credits - Remove commission credit
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

    await dbAdapter.query(`DELETE FROM commission_credits WHERE id = $1`, [parseInt(id)], {
      schema: 'content',
    });

    logger.info(`Commission credit deleted: ${id}`);

    return NextResponse.json({ message: 'Commission credit removed successfully' });
  } catch (error) {
    logger.error('Error deleting commission credit:', error);
    return errorResponse(new DatabaseError('Failed to delete commission credit', error as Error));
  }
}

export const GET = withSecurity(getHandler, { enableCSRF: false });
export const POST = withSecurity(postHandler, { enableCSRF: true });
export const PUT = withSecurity(putHandler, { enableCSRF: true });
export const DELETE = withSecurity(deleteHandler, { enableCSRF: true });
