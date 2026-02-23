import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function putHandler(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user!;
    const body = await request.json();

    const { email_notifications_enabled, email_message_notifications, email_reply_notifications } =
      body;

    // Validate input
    if (
      typeof email_notifications_enabled !== 'boolean' ||
      typeof email_message_notifications !== 'boolean' ||
      typeof email_reply_notifications !== 'boolean'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid input parameters' },
        { status: 400 }
      );
    }

    // Update preferences in database
    await dbAdapter.query(
      `UPDATE users.users
       SET email_notifications_enabled = $1,
           email_message_notifications = $2,
           email_reply_notifications = $3
       WHERE id = $4`,
      [email_notifications_enabled, email_message_notifications, email_reply_notifications, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Email preferences updated successfully',
    });
  } catch (error) {
    logger.error('Email preferences update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update email preferences' },
      { status: 500 }
    );
  }
}

export const PUT = withSecurity(putHandler, { enableCSRF: true });
