import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { requireAuth } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    userId: string;
  }>;
}

async function getHandler(request: NextRequest, { params }: RouteParams) {
  const messagingService = new MessagingService();

  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const resolvedParams = await params;
    const otherUserId = parseInt(resolvedParams.userId);

    if (isNaN(otherUserId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // Get the other user's info from users database
    const otherUserResult = await dbAdapter.query(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [otherUserId],
      { schema: 'users' }
    );
    const otherUser = otherUserResult.rows[0];

    if (!otherUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Find existing conversation between users
    const existingConversationResult = await dbAdapter.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
       WHERE cp1.is_active = TRUE AND cp2.is_active = TRUE
       LIMIT 1`,
      [currentUser.id, otherUserId],
      { schema: 'messaging' }
    );

    let conversationId = existingConversationResult.rows[0]?.id;

    // Create conversation if it doesn't exist
    if (!conversationId) {
      const subject = `Conversation with ${otherUser.username}`;

      const insertResult = await dbAdapter.query(
        `INSERT INTO conversations (subject, created_by, created_at, updated_at, is_archived)
         VALUES ($1, $2, NOW(), NOW(), FALSE)
         RETURNING id`,
        [subject, currentUser.id],
        { schema: 'messaging', returnLastId: true }
      );

      conversationId = insertResult.rows[0]?.id;

      // Add participants
      await dbAdapter.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, joined_at, last_read_at, is_active)
         VALUES ($1, $2, NOW(), NOW(), TRUE)`,
        [conversationId, currentUser.id],
        { schema: 'messaging' }
      );

      await dbAdapter.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, joined_at, last_read_at, is_active)
         VALUES ($1, $2, NOW(), NOW(), TRUE)`,
        [conversationId, otherUserId],
        { schema: 'messaging' }
      );
    }

    // Get conversation details with the service
    const conversation = await messagingService.getConversation(conversationId, currentUser.id);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get messages count for pagination info
    const countResult = await dbAdapter.query(
      'SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1 AND is_deleted = FALSE',
      [conversationId],
      { schema: 'messaging' }
    );
    const total = countResult.rows[0]?.total || 0;

    // Update last read timestamp
    await dbAdapter.query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, currentUser.id],
      { schema: 'messaging' }
    );

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: conversationId,
          other_user: otherUser,
          subject: conversation.subject,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          unread_count: conversation.unread_count || 0,
          is_archived: conversation.is_archived || false,
          participants: conversation.participants,
        },
        messages: [], // Messages are fetched separately via /messages endpoint
        pagination: {
          total,
          hasMessages: total > 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// Archive/unarchive conversation
async function patchHandler(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const resolvedParams = await params;
    const otherUserId = parseInt(resolvedParams.userId);

    if (isNaN(otherUserId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();
    const { archived } = body;

    if (typeof archived !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Archived status must be true or false' },
        { status: 400 }
      );
    }

    // Find the conversation
    const conversationResult = await dbAdapter.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
       WHERE cp1.is_active = TRUE AND cp2.is_active = TRUE
       LIMIT 1`,
      [currentUser.id, otherUserId],
      { schema: 'messaging' }
    );
    const conversation = conversationResult.rows[0];

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Update archive status for current user's participation
    await dbAdapter.query(
      `UPDATE conversation_participants
       SET is_active = $1
       WHERE conversation_id = $2 AND user_id = $3`,
      [!archived, conversation.id, currentUser.id],
      { schema: 'messaging' }
    );

    return NextResponse.json({
      success: true,
      data: { archived },
    });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(getHandler, {});

export const PATCH = withSecurity(patchHandler, {
  enableCSRF: true,
});
