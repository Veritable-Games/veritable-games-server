import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { requireAuth } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler(request: NextRequest) {
  const messagingService = new MessagingService();

  try {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const currentUser = authResult.user!;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const filter = searchParams.get('filter') || 'all';
    const offset = (page - 1) * limit;

    // Get conversations using the service
    const conversations = await messagingService.getUserConversations(
      currentUser.id,
      limit,
      offset
    );

    // Transform conversations to match the expected inbox format
    const processedConversations = conversations.map(conv => {
      // Find the other participant (not the current user)
      const otherParticipant = conv.participants?.find(p => p.user_id !== currentUser.id);

      return {
        conversation_id: conv.id,
        subject: conv.subject,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_preview: conv.latest_message?.content
          ? conv.latest_message.content.substring(0, 100) +
            (conv.latest_message.content.length > 100 ? '...' : '')
          : null,
        last_message_time: conv.latest_message?.created_at,
        last_message_from: conv.latest_message?.sender_id,
        is_last_message_from_me: conv.latest_message?.sender_id === currentUser.id,
        last_activity: conv.latest_message?.created_at || conv.updated_at,
        unread_count: conv.unread_count || 0,
        other_user: otherParticipant?.user
          ? {
              id: otherParticipant.user.id,
              username: otherParticipant.user.username,
              display_name: otherParticipant.user.display_name,
              avatar_url: otherParticipant.user.avatar_url,
              last_seen: undefined, // Not available from messaging service
            }
          : {
              id: 0,
              username: 'Unknown',
              display_name: 'Unknown User',
              avatar_url: undefined,
              last_seen: undefined,
            },
      };
    });

    // Calculate total unread count
    const total_unread = processedConversations.reduce((sum, conv) => sum + conv.unread_count, 0);

    // For pagination, we'd need to add a getTotalConversations method to the service
    // For now, we'll estimate based on whether we got a full page
    const hasMore = conversations.length === limit;

    return NextResponse.json({
      success: true,
      data: {
        conversations: processedConversations,
        pagination: {
          page,
          limit,
          total: hasMore ? page * limit + 1 : offset + conversations.length,
          totalPages: hasMore ? page + 1 : page,
          hasMore,
        },
        unreadCount: total_unread,
        filter,
      },
    });
  } catch (error) {
    logger.error('Error fetching inbox:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
