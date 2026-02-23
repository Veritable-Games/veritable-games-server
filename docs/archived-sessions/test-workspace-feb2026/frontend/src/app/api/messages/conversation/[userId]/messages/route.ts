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

interface ConversationQueryResult {
  id: number;
}

async function GETHandler(request: NextRequest, { params }: RouteParams) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Find conversation between users
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
    const conversation = conversationResult.rows[0] as ConversationQueryResult;

    if (!conversation) {
      // No conversation exists yet
      return NextResponse.json({
        success: true,
        data: {
          messages: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        },
      });
    }

    // Get messages using the service
    const messages = await messagingService.getConversationMessages(
      conversation.id,
      currentUser.id,
      limit,
      offset
    );

    // Get total count for pagination
    const countResult = await dbAdapter.query(
      'SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1 AND is_deleted = FALSE',
      [conversation.id],
      { schema: 'messaging' }
    );
    const total = countResult.rows[0]?.total || 0;

    // Mark messages as read by updating last_read_at
    if (messages.length > 0) {
      await dbAdapter.query(
        `UPDATE conversation_participants
         SET last_read_at = NOW()
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversation.id, currentUser.id],
        { schema: 'messaging' }
      );
    }

    // Transform messages to match expected format
    const transformedMessages = messages.map(msg => ({
      ...msg,
      from_user_id: msg.sender_id,
      to_user_id: msg.sender_id === currentUser.id ? otherUserId : currentUser.id,
      is_from_me: msg.sender_id === currentUser.id,
      read_status: true, // We just marked them as read
      sender: msg.sender || {
        id: msg.sender_id,
        username: `user_${msg.sender_id}`,
        display_name: undefined,
        avatar_url: undefined,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        messages: transformedMessages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + messages.length < total,
          hasNewer: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// Send a message
async function POSTHandler(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Get or create conversation
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
    let conversation = conversationResult.rows[0] as ConversationQueryResult;

    if (!conversation) {
      // Create new conversation
      const otherUserResult = await dbAdapter.query(
        'SELECT username FROM users WHERE id = $1',
        [otherUserId],
        { schema: 'users' }
      );
      const otherUser = otherUserResult.rows[0];

      if (!otherUser) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      const subject = `Conversation with ${otherUser.username}`;

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
        [conversationId, otherUserId],
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

    return NextResponse.json({
      success: true,
      data: {
        message: {
          ...message,
          from_user_id: message.sender_id,
          to_user_id: otherUserId,
          is_from_me: true,
        },
      },
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}

export const GET = withSecurity(GETHandler, {});

export const POST = withSecurity(POSTHandler, {
  enableCSRF: true,
});
