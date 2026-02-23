import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function verifyAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);
  return user && user.role === 'admin';
}

async function postHandler(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, items, input } = await request.json();

    if (!action || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    let result;
    const placeholders = items.map((_, i) => `$${i + 2}`).join(',');

    switch (action) {
      case 'update-status':
        if (!input) {
          return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }
        result = await dbAdapter.query(
          `
          UPDATE projects
          SET status = $1, updated_at = NOW()
          WHERE id IN (${placeholders})
        `,
          [input, ...items],
          { schema: 'content' }
        );
        break;

      case 'update-category':
        if (!input) {
          return NextResponse.json({ error: 'Category is required' }, { status: 400 });
        }
        result = await dbAdapter.query(
          `
          UPDATE projects
          SET category = $1, updated_at = NOW()
          WHERE id IN (${placeholders})
        `,
          [input, ...items],
          { schema: 'content' }
        );
        break;

      case 'reorder':
        if (!input) {
          return NextResponse.json({ error: 'Display orders are required' }, { status: 400 });
        }
        // Parse comma-separated IDs for new order
        const newOrder = input.split(',').map((id: string) => parseInt(id.trim()));
        if (newOrder.length !== items.length) {
          return NextResponse.json(
            { error: 'Order list must match selected items' },
            { status: 400 }
          );
        }

        for (let i = 0; i < items.length; i++) {
          await dbAdapter.query(
            `
            UPDATE projects
            SET display_order = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [i + 1, newOrder[i]],
            { schema: 'content' }
          );
        }

        result = { rowCount: items.length };
        break;

      case 'duplicate':
        let duplicated = 0;
        for (const itemId of items) {
          await dbAdapter.query(
            `
            INSERT INTO projects (title, slug, status, description, category, color, display_order, is_universal_system)
            SELECT
              title || ' (Copy)',
              slug || '-copy-' || CAST((SELECT MAX(id) FROM projects) + 1 AS TEXT),
              'Concept',
              description,
              category,
              color,
              (SELECT MAX(display_order) FROM projects) + 1,
              is_universal_system
            FROM projects WHERE id = $1
          `,
            [itemId],
            { schema: 'content' }
          );
          duplicated++;
        }

        result = { rowCount: duplicated };
        break;

      case 'archive':
        result = await dbAdapter.query(
          `
          UPDATE projects
          SET status = 'Archive', updated_at = NOW()
          WHERE id IN (${placeholders})
        `,
          items,
          { schema: 'content' }
        );
        break;

      case 'delete':
        result = await dbAdapter.query(
          `
          DELETE FROM projects WHERE id IN (${placeholders})
        `,
          items,
          { schema: 'content' }
        );
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      affected: result.rowCount,
      action,
      items: items.length,
    });
  } catch (error) {
    logger.error('Error executing bulk operation:', error);
    return NextResponse.json({ error: 'Failed to execute bulk operation' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
