import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import type { TracedContentRow, UpdateTraceRequest } from '@/lib/tracing/types';
import { rowToTracedContent } from '@/lib/tracing/types';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/traces/[id] - Get a single trace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const resolvedParams = await params;
    const traceId = parseInt(resolvedParams.id, 10);

    if (isNaN(traceId)) {
      return NextResponse.json({ error: 'Invalid trace ID' }, { status: 400 });
    }

    const user = await getCurrentUser(request);
    const isAdmin = user?.role === 'admin';

    // Get the trace
    const statusFilter = isAdmin ? '' : "AND status = 'published'";

    const result = await dbAdapter.query(
      `SELECT * FROM project_traced_content
       WHERE id = $1 AND project_slug = $2 ${statusFilter}`,
      [traceId, resolvedParams.slug],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    const trace = rowToTracedContent(result.rows[0] as TracedContentRow);

    return NextResponse.json({ trace });
  } catch (error) {
    logger.error('Error fetching trace:', error);
    return NextResponse.json({ error: 'Failed to fetch trace' }, { status: 500 });
  }
}

// PUT /api/projects/[slug]/traces/[id] - Update a trace (admin only)
async function updateTrace(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const resolvedParams = await params;
    const traceId = parseInt(resolvedParams.id, 10);

    if (isNaN(traceId)) {
      return NextResponse.json({ error: 'Invalid trace ID' }, { status: 400 });
    }

    const body: UpdateTraceRequest = await request.json();

    // Verify trace exists and belongs to this project
    const existingResult = await dbAdapter.query(
      'SELECT * FROM project_traced_content WHERE id = $1 AND project_slug = $2',
      [traceId, resolvedParams.slug],
      { schema: 'content' }
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (body.tracedContent !== undefined) {
      updates.push(`traced_content = $${paramIndex++}`);
      values.push(body.tracedContent);
    }

    if (body.status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }

    if (body.freeformX !== undefined) {
      updates.push(`freeform_x = $${paramIndex++}`);
      values.push(body.freeformX);
    }

    if (body.freeformY !== undefined) {
      updates.push(`freeform_y = $${paramIndex++}`);
      values.push(body.freeformY);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Add trace ID and slug for WHERE clause
    values.push(traceId);
    values.push(resolvedParams.slug);

    const result = await dbAdapter.query(
      `UPDATE project_traced_content
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND project_slug = $${paramIndex}
       RETURNING *`,
      values,
      { schema: 'content' }
    );

    const trace = rowToTracedContent(result.rows[0] as TracedContentRow);

    return NextResponse.json({ trace });
  } catch (error) {
    logger.error('Error updating trace:', error);
    return NextResponse.json({ error: 'Failed to update trace' }, { status: 500 });
  }
}

export const PUT = withSecurity(updateTrace, {
  enableCSRF: true,
});

// DELETE /api/projects/[slug]/traces/[id] - Delete a trace (admin only)
async function deleteTrace(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const resolvedParams = await params;
    const traceId = parseInt(resolvedParams.id, 10);

    if (isNaN(traceId)) {
      return NextResponse.json({ error: 'Invalid trace ID' }, { status: 400 });
    }

    const result = await dbAdapter.query(
      'DELETE FROM project_traced_content WHERE id = $1 AND project_slug = $2 RETURNING id',
      [traceId, resolvedParams.slug],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: traceId });
  } catch (error) {
    logger.error('Error deleting trace:', error);
    return NextResponse.json({ error: 'Failed to delete trace' }, { status: 500 });
  }
}

export const DELETE = withSecurity(deleteTrace, {
  enableCSRF: true,
});
