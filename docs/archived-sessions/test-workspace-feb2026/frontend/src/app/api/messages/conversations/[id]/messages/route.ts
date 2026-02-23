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

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

    const messages = await messagingService.getConversationMessages(
      conversationId,
      user.id,
      limit,
      offset
    );

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        limit,
        offset,
        has_more: messages.length === limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

async function postHandler(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const message = await messagingService.sendMessage(
      {
        conversation_id: conversationId,
        content: content.trim(),
      },
      user.id
    );

    return NextResponse.json(
      {
        success: true,
        message,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error sending message:', error);

    if (error instanceof Error && error.message.includes('not a participant')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, {});

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
