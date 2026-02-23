import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { requireAuth } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest) {
  const messagingService = new MessagingService();

  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const body = await request.json();

    const { to_user_id, content } = body;

    // Validate required fields
    if (!to_user_id || !content) {
      return NextResponse.json(
        { success: false, error: 'Recipient and content are required' },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Message content too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Check if recipient exists
    const recipientResult = await dbAdapter.query(
      'SELECT id, username FROM users WHERE id = $1',
      [to_user_id],
      { schema: 'users' }
    );
    const recipient = recipientResult.rows[0];

    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 });
    }

    // Can't send message to yourself
    if (to_user_id === currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot send message to yourself' },
        { status: 400 }
      );
    }

    // Find or create conversation
    const conversationResult = await dbAdapter.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
       WHERE cp1.is_active = TRUE AND cp2.is_active = TRUE
       LIMIT 1`,
      [currentUser.id, to_user_id],
      { schema: 'messaging' }
    );

    let conversation = conversationResult.rows[0];

    if (!conversation) {
      // Create new conversation
      const subject = `Conversation with ${recipient.username}`;

      const insertResult = await dbAdapter.query(
        `INSERT INTO conversations (subject, created_by, created_at, updated_at, is_archived)
         VALUES ($1, $2, NOW(), NOW(), FALSE)
         RETURNING id`,
        [subject, currentUser.id],
        { schema: 'messaging', returnLastId: true }
      );

      const conversationId = insertResult.rows[0]?.id;

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
        [conversationId, to_user_id],
        { schema: 'messaging' }
      );

      conversation = { id: conversationId };
    }

    // Send the message
    const message = await messagingService.sendMessage(
      {
        conversation_id: conversation.id,
        content: content.trim(),
        message_type: 'text',
      },
      currentUser.id
    );

    // Transform message to match expected format
    return NextResponse.json({
      success: true,
      data: {
        message: {
          ...message,
          from_user_id: currentUser.id,
          to_user_id: to_user_id,
          is_from_me: true,
          read_status: false,
          sender: message.sender || {
            id: currentUser.id,
            username: currentUser.username,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
