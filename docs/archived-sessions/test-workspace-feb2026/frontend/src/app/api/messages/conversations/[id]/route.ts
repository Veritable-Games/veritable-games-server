import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

async function getHandler(request: NextRequest, { params }: RouteParams) {
  const messagingService = new MessagingService();

  try {
    const resolvedParams = await params;
    const conversationId = parseInt(resolvedParams.id);

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const user = await messagingService.getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await messagingService.getConversation(conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Mark conversation as read
    await messagingService.markConversationAsRead(conversationId, user.id);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, {});
