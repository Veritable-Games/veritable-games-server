import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { requireAuth } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function getHandler(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per page
    const unreadOnly = searchParams.get('unread') === 'true';
    const type = searchParams.get('type'); // message, follow, friend_request, mention, system
    const offset = (page - 1) * limit;

    const conditions = ['n.user_id = $1'];
    let params: any[] = [currentUser.id];
    let paramIndex = 2;

    if (unreadOnly) {
      conditions.push('n.read_status = FALSE');
    }

    if (type) {
      conditions.push(`n.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    // Add expiration check
    conditions.push('(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)');

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications n
      ${whereClause}
    `;

    const countResult = await dbAdapter.query<{ total: string }>(countQuery, params, {
      schema: 'system',
    });
    const total = Number(countResult.rows[0]!.total);

    // Get notifications with related user info where applicable
    const notificationsQuery = `
      SELECT
        n.*,
        -- Get related user info for user-related notifications
        CASE
          WHEN n.entity_type = 'user' THEN (
            SELECT JSON_BUILD_OBJECT(
              'id', u.id,
              'username', u.username,
              'display_name', u.display_name,
              'avatar_url', u.avatar_url
            )
            FROM auth.users u
            WHERE u.id = n.entity_id AND u.is_active = TRUE
          )
          ELSE NULL
        END as related_user
      FROM notifications n
      ${whereClause}
      ORDER BY
        CASE WHEN n.priority = 'urgent' THEN 1
             WHEN n.priority = 'high' THEN 2
             WHEN n.priority = 'normal' THEN 3
             ELSE 4 END,
        n.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const notificationsResult = await dbAdapter.query(
      notificationsQuery,
      [...params, limit, offset],
      { schema: 'system' }
    );

    // Process notifications
    const processedNotifications = notificationsResult.rows.map((notif: any) => ({
      ...notif,
      related_user: notif.related_user || null,
      metadata: typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata,
    }));

    // Get unread count for all notifications
    const unreadCountResult = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read_status = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `,
      [currentUser.id],
      { schema: 'system' }
    );
    const unreadCount = Number(unreadCountResult.rows[0]!.count);

    // Get unread counts by type
    const unreadByTypeResult = await dbAdapter.query(
      `
      SELECT
        type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read_status = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      GROUP BY type
    `,
      [currentUser.id],
      { schema: 'system' }
    );

    const unreadCounts = unreadByTypeResult.rows.reduce((acc: any, item: any) => {
      acc[item.type] = Number(item.count) || 0;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        notifications: processedNotifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + processedNotifications.length < total,
        },
        unreadCount,
        unreadByType: unreadCounts,
        filters: {
          unreadOnly,
          type,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// Mark notifications as read
async function patchHandler(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const body = await request.json();

    const { notification_ids, mark_all = false, type } = body;

    let markedCount = 0;

    if (mark_all) {
      // Mark all notifications as read, optionally filtered by type
      let query = `
        UPDATE notifications
        SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND read_status = FALSE
      `;
      const params = [currentUser.id];

      if (type) {
        query += ' AND type = $2';
        params.push(type);
      }

      const result = await dbAdapter.query(query, params, { schema: 'system' });
      markedCount = result.rowCount || 0;
    } else if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
      // Mark specific notifications as read
      const placeholders = notification_ids.map((_, i) => `$${i + 2}`).join(',');
      const result = await dbAdapter.query(
        `
        UPDATE notifications
        SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND id IN (${placeholders}) AND read_status = FALSE
      `,
        [currentUser.id, ...notification_ids],
        { schema: 'system' }
      );
      markedCount = result.rowCount || 0;
    } else {
      throw new Error('Either notification_ids or mark_all must be provided');
    }

    // Get updated unread count
    const unreadCountResult = await dbAdapter.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read_status = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `,
      [currentUser.id],
      { schema: 'system' }
    );

    return NextResponse.json({
      success: true,
      data: {
        marked_count: markedCount,
        unread_count: Number(unreadCountResult.rows[0]!.count),
      },
    });
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notifications',
      },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {});

export const PATCH = withSecurity(patchHandler, {
  enableCSRF: true,
});
